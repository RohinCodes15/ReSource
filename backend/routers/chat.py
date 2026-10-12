"""POST /chat: the ReSource AI assistant.

What this module does:
  1. Accepts the resident's message, the language they picked in the app, and the earlier
     turns of the conversation (so Claude remembers context within a chat session).
  2. Loads the current services and resources from Supabase and puts them in the system
     prompt, so answers are grounded in real data instead of the model's guesses.
  3. Tells Claude to answer in the resident's language.

Mounted by main.py with `app.include_router(chat.router)`.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Literal

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from supabase_client import supabase

logger = logging.getLogger("resource.chat")
router = APIRouter(tags=["chat"])

# Languages the app offers. Keys match the app's locale codes (app/locales/*.json).
LANGUAGES: dict[str, str] = {
    "en": "English",
    "es": "Spanish",
    "fa": "Dari (Afghan Persian, written in Persian script)",
    "zh": "Mandarin Chinese (Simplified characters)",
    "vi": "Vietnamese",
}
LanguageCode = Literal["en", "es", "fa", "zh", "vi"]

DEFAULT_MODEL = "claude-opus-5-5"
# Models that accept the `effort` setting and the automatic refusal fallback used below.
CURRENT_MODELS = ("claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1")
MAX_HISTORY_TURNS = 20
# Bundled sample data, used only when Supabase is not configured or the query fails.
LOCAL_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

BASE_PROMPT = """You are ReSource, an assistant for residents of Fremont, California during the \
city's budget crisis. You help people understand which city services are being cut and find \
alternative services nearby.

Answer from the service and resource lists below. If the answer is not in them, say you are not \
sure and suggest the resident call the organization or the City of Fremont to confirm. Never \
invent addresses, phone numbers, hours, or budget figures.

Keep answers short and in plain words, because many residents read on a phone and some are \
reading in a second language. When you recommend a resource, include its phone number and \
address. Be kind: people asking may be worried about losing a service they depend on."""


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    """Send either `messages` (the whole conversation, ending with the new user turn) or the
    older `message` + `history` pair. Both are accepted so existing clients keep working."""

    messages: list[ChatTurn] = Field(default_factory=list, max_length=MAX_HISTORY_TURNS + 1)
    message: str | None = Field(default=None, min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=MAX_HISTORY_TURNS)
    language: LanguageCode = "en"
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def require_a_user_turn(self) -> "ChatRequest":
        if not self.messages and not self.message:
            raise ValueError("Provide `messages` or `message`.")
        if self.messages and not self.message and self.messages[-1].role != "user":
            raise ValueError("The last entry in `messages` must be from the user.")
        return self

    def conversation(self) -> list[dict[str, str]]:
        """The turns to send to Claude, oldest first, ending with the new user message."""
        turns = list(self.messages) if self.messages else list(self.history)
        if self.message:
            turns.append(ChatTurn(role="user", content=self.message))
        turns = turns[-(MAX_HISTORY_TURNS + 1):]
        # The API requires the first turn to come from the user.
        while turns and turns[0].role != "user":
            turns.pop(0)
        return [turn.model_dump() for turn in turns]


class ChatResponse(BaseModel):
    reply: str
    source: Literal["claude"]
    language: LanguageCode


def _load_local(name: str) -> list[dict]:
    try:
        return json.loads((LOCAL_DATA_DIR / f"{name}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        logger.exception("Could not read bundled %s data", name)
        return []


def load_context_data() -> tuple[list[dict], list[dict], str]:
    """Returns (services, resources, origin). `origin` says where the data came from."""
    if supabase is not None:
        try:
            services = supabase.table("services").select("*").order("name").execute().data or []
            resources = supabase.table("resources").select("*").order("name").execute().data or []
            return services, resources, "supabase"
        except Exception:
            logger.exception("Supabase query failed; using bundled sample data for chat context")
    return _load_local("services"), _load_local("resources"), "sample"


def _service_line(service: dict) -> str:
    parts = [f"- {service.get('name', 'Unknown service')} ({service.get('category', 'service')})"]
    parts.append(f"status: {service.get('status', 'unknown')}")
    if service.get("cut_amount"):
        parts.append(f"budget cut: ${int(service['cut_amount']):,}")
    if service.get("effective_date"):
        parts.append(f"effective: {service['effective_date']}")
    if service.get("address"):
        parts.append(f"address: {service['address']}")
    if service.get("description"):
        parts.append(str(service["description"]))
    return "; ".join(parts)


def _resource_line(resource: dict) -> str:
    parts = [f"- {resource.get('name', 'Unknown resource')} ({resource.get('category', 'resource')})"]
    for label, key in (("address", "address"), ("phone", "phone"), ("website", "website")):
        if resource.get(key):
            parts.append(f"{label}: {resource[key]}")
    if resource.get("languages"):
        parts.append("languages spoken: " + ", ".join(resource["languages"]))
    if resource.get("description"):
        parts.append(str(resource["description"]))
    return "; ".join(parts)


def build_system_prompt(request: ChatRequest) -> str:
    services, resources, origin = load_context_data()
    cut = [s for s in services if s.get("status") != "open"]
    still_open = [s for s in services if s.get("status") == "open"]

    sections = [BASE_PROMPT]
    if origin == "sample":
        sections.append(
            "The lists below are sample data, not official city records. Tell the resident to "
            "confirm details before relying on them."
        )
    sections.append("City services that are cut, reduced, or closed:\n" + ("\n".join(map(_service_line, cut)) or "- None listed."))
    if still_open:
        sections.append("City services that are still open:\n" + "\n".join(map(_service_line, still_open)))
    sections.append("Alternative resources residents can use:\n" + ("\n".join(map(_resource_line, resources)) or "- None listed."))
    if request.latitude is not None and request.longitude is not None:
        sections.append(
            f"The resident shared their location: latitude {request.latitude:.4f}, longitude "
            f"{request.longitude:.4f}. Prefer services and resources in the part of Fremont closest to them."
        )
    sections.append(
        f"Write your whole reply in {LANGUAGES[request.language]}, because that is the language the "
        "resident chose in the app. Keep the names of organizations, street addresses, and phone "
        "numbers exactly as they appear in the lists so the resident can search for or dial them."
    )
    return "\n\n".join(sections)


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Claude is not configured. Set ANTHROPIC_API_KEY on the API server.")

    model = os.getenv("CLAUDE_MODEL", DEFAULT_MODEL)
    params: dict = {
        "model": model,
        "max_tokens": 16000,
        "system": build_system_prompt(request),
        "messages": request.conversation(),
    }
    if model in CURRENT_MODELS:
        # Short factual answers do not need deep reasoning; low effort keeps replies fast and cheap.
        params["output_config"] = {"effort": "low"}
        # If a safety check declines the request, the API retries it on Anthropic's recommended
        # fallback model inside the same call. Sent through extra_body so it works on any SDK version.
        params["betas"] = ["server-side-fallback-2026-07-01"]
        params["extra_body"] = {"fallbacks": "default"}

    client = anthropic.Anthropic(api_key=api_key, timeout=60.0)
    try:
        create = client.beta.messages.create if "betas" in params else client.messages.create
        response = create(**params)
    except anthropic.AuthenticationError as exc:
        raise HTTPException(status_code=503, detail="The ANTHROPIC_API_KEY on the API server was rejected.") from exc
    except anthropic.NotFoundError as exc:
        raise HTTPException(status_code=503, detail=f"Claude model '{model}' was not found. Check CLAUDE_MODEL.") from exc
    except anthropic.RateLimitError as exc:
        raise HTTPException(status_code=429, detail="The assistant is busy. Please try again in a moment.") from exc
    except anthropic.APIStatusError as exc:
        logger.exception("Claude API error (status %s)", exc.status_code)
        raise HTTPException(status_code=502, detail="Claude could not answer the request") from exc
    except anthropic.APIConnectionError as exc:
        raise HTTPException(status_code=502, detail="Could not reach Claude") from exc

    # Check the stop reason before reading content: a declined request has no usable answer.
    if response.stop_reason == "refusal":
        raise HTTPException(status_code=422, detail="The assistant could not answer that question.")
    answer = "\n".join(block.text for block in response.content if block.type == "text").strip()
    if not answer:
        raise HTTPException(status_code=502, detail="Claude returned an empty response")
    return ChatResponse(reply=answer, source="claude", language=request.language)
