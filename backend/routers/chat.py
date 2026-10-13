"""The ReSource assistant: POST /chat (one JSON reply) and POST /chat/stream (server-sent events).

Each request carries the conversation so far and the resident's language. The system prompt is
rebuilt from the database on every request (see grounding.py), so the assistant can only state
what is in the services, resources, budget and council data. With no ANTHROPIC_API_KEY the same
routes answer in "basic" mode: a direct lookup of that data, clearly labeled.
"""
from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from typing import Any, Literal

import anthropic
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import grounding
from schemas import ChatIn
from security import rate_limit
from settings import get_settings

logger = logging.getLogger("resource.chat")
router = APIRouter(tags=["chat"])

# Models that accept the `effort` setting. Short factual answers do not need deep reasoning.
EFFORT_MODELS = ("claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1")
# Models where a request declined by a safety check can be retried server-side on Anthropic's
# recommended fallback model. Claude Haiku 5.5 has no server-side fallback.
FALLBACK_MODELS = ("claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1")
# Answers are meant to be short; this also bounds what one question can cost.
MAX_TOKENS = 2000

REFUSAL_TEXT = {
    "en": "I can't help with that. I can answer questions about Fremont city services, budget changes and places to get help.",
    "es": "No puedo ayudar con eso. Puedo responder preguntas sobre los servicios de la ciudad de Fremont, los cambios del presupuesto y dónde conseguir ayuda.",
    "fa": "در این مورد کمک کرده نمی‌توانم. می‌توانم به پرسش‌ها دربارهٔ خدمات شهر فریمانت، تغییرات بودجه و جاهای دریافت کمک پاسخ بدهم.",
    "zh": "这个问题我帮不上忙。我可以回答有关弗里蒙特市政服务、预算变化和求助地点的问题。",
    "vi": "Tôi không thể giúp việc đó. Tôi có thể trả lời câu hỏi về dịch vụ của thành phố Fremont, thay đổi ngân sách và nơi nhận trợ giúp.",
}


class Refused(Exception):
    """The model (and its fallback) declined to answer."""


class ChatOut(BaseModel):
    reply: str
    sources: list[str]
    mode: Literal["ai", "basic"]
    language: str


class AnthropicLLM:
    """Thin wrapper around the Anthropic SDK so tests can swap in a fake with the same methods."""

    def __init__(self, api_key: str, model: str) -> None:
        self.client = anthropic.Anthropic(api_key=api_key, timeout=60.0)
        self.model = model

    def _params(self, system: list[dict], messages: list[dict]) -> dict[str, Any]:
        params: dict[str, Any] = {"model": self.model, "max_tokens": MAX_TOKENS, "system": system, "messages": messages}
        if self.model in EFFORT_MODELS:
            params["output_config"] = {"effort": "low"}
        if self.model in FALLBACK_MODELS:
            params["betas"] = ["server-side-fallback-2026-07-01"]
            params["extra_body"] = {"fallbacks": "default"}
        return params

    def complete(self, system: list[dict], messages: list[dict]) -> str:
        params = self._params(system, messages)
        create = self.client.beta.messages.create if "betas" in params else self.client.messages.create
        response = create(**params)
        # Check the stop reason before reading content: a declined request has no usable answer.
        if response.stop_reason == "refusal":
            raise Refused()
        return "\n".join(block.text for block in response.content if block.type == "text").strip()

    def stream(self, system: list[dict], messages: list[dict]) -> Iterator[str]:
        params = self._params(system, messages)
        open_stream = self.client.beta.messages.stream if "betas" in params else self.client.messages.stream
        with open_stream(**params) as stream:
            yield from stream.text_stream
            if stream.get_final_message().stop_reason == "refusal":
                raise Refused()


def get_llm() -> AnthropicLLM | None:
    settings = get_settings()
    return AnthropicLLM(settings.anthropic_api_key, settings.claude_model) if settings.ai_enabled else None


def _basic(request: ChatIn) -> ChatOut:
    reply, sources = grounding.local_answer(request.messages[-1].content, request.language, request.latitude, request.longitude)
    return ChatOut(reply=reply, sources=sources, mode="basic", language=request.language)


def _refusal(request: ChatIn) -> ChatOut:
    return ChatOut(reply=REFUSAL_TEXT.get(request.language, REFUSAL_TEXT["en"]), sources=[], mode="ai", language=request.language)


def _log_failure(exc: Exception) -> None:
    if isinstance(exc, anthropic.AuthenticationError):
        logger.error("The ANTHROPIC_API_KEY on the server was rejected")
    elif isinstance(exc, anthropic.NotFoundError):
        logger.error("Claude model %r was not found; check CLAUDE_MODEL", get_settings().claude_model)
    elif isinstance(exc, anthropic.RateLimitError):
        logger.warning("Claude rate limit reached")
    elif isinstance(exc, anthropic.APIStatusError):
        logger.error("Claude API error (status %s)", exc.status_code)
    elif isinstance(exc, anthropic.APIConnectionError):
        logger.error("Could not reach the Claude API")
    else:
        logger.exception("Unexpected error while answering a chat message")


chat_limits = [Depends(rate_limit("chat", 12, 60)), Depends(rate_limit("chat-day", 150, 86400))]


@router.post("/chat", response_model=ChatOut, dependencies=chat_limits)
def chat(request: ChatIn) -> ChatOut:
    llm = get_llm()
    if llm is None:
        return _basic(request)
    system, names = grounding.build_system(request.language, request.latitude, request.longitude, request.area_label)
    try:
        reply = llm.complete(system, request.conversation())
    except Refused:
        return _refusal(request)
    except Exception as exc:  # the AI service is down or misconfigured: still give a grounded answer
        _log_failure(exc)
        return _basic(request)
    if not reply:
        return _basic(request)
    return ChatOut(reply=reply, sources=grounding.detect_sources(reply, names), mode="ai", language=request.language)


def _event(name: str, payload: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/chat/stream", dependencies=chat_limits)
def chat_stream(request: ChatIn) -> StreamingResponse:
    """Server-sent events: `delta` {text} repeated, then `done` {sources, mode}.

    `reset` {text} replaces everything sent so far (used when an answer is withdrawn part-way).
    """
    llm = get_llm()

    def events() -> Iterator[str]:
        def finish(result: ChatOut, replace: bool) -> Iterator[str]:
            yield _event("reset" if replace else "delta", {"text": result.reply})
            yield _event("done", {"sources": result.sources, "mode": result.mode})

        if llm is None:
            yield from finish(_basic(request), replace=False)
            return
        try:
            system, names = grounding.build_system(request.language, request.latitude, request.longitude, request.area_label)
            parts: list[str] = []
            for text in llm.stream(system, request.conversation()):
                parts.append(text)
                yield _event("delta", {"text": text})
            reply = "".join(parts).strip()
            if not reply:
                yield from finish(_basic(request), replace=True)
                return
            yield _event("done", {"sources": grounding.detect_sources(reply, names), "mode": "ai"})
        except Refused:
            yield from finish(_refusal(request), replace=True)
        except Exception as exc:
            _log_failure(exc)
            yield from finish(_basic(request), replace=True)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.get("/chat/status")
def chat_status() -> dict[str, Any]:
    if not get_settings().ai_enabled:
        return {"mode": "basic"}
    return {"mode": "ai", "model": get_settings().claude_model}

