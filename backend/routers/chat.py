"""The ReSource assistant: POST /chat (one JSON reply) and POST /chat/stream (server-sent events).

Each request carries the resident's question and language. In "ai" mode (shown in the app as
"Claude AI") a general-purpose Claude model answers from its own knowledge; see grounding.RULES
for how it handles Fremont-specific facts it cannot source. The same routes answer in "basic"
mode, a direct keyword lookup of ReSource's data, clearly labeled, whenever Claude is unavailable:
no ANTHROPIC_API_KEY, a failed API call, or the daily token budget spent (chat_budget.py).
"""
from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from typing import Any, Literal

import anthropic
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import grounding
from answer_validation import reply_is_acceptable
from chat_budget import budget
from chat_sessions import sessions
from schemas import ChatIn
from security import chat_global_limit, owner_from, rate_limit
from settings import get_settings

logger = logging.getLogger("resource.chat")
router = APIRouter(tags=["chat"])

# Models that accept the `effort` setting. Chat answers do not need deep reasoning, and low effort
# keeps each answer cheaper.
EFFORT_MODELS = ("claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-sonnet-5", "claude-haiku-5-5", "claude-fable-5-1")
# Models where a request declined by a safety check can be retried server-side on Anthropic's
# recommended fallback model. Claude Sonnet 5 and Claude Haiku 5.5 have no server-side fallback;
# a declined answer there gets REFUSAL_TEXT.
FALLBACK_MODELS = ("claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1")
# Answers are meant to be short; this also bounds what one question can cost. The daily total is
# bounded separately by CHAT_DAILY_TOKEN_BUDGET.
MAX_TOKENS = 1500
# Includes the latest question. Drop old whole turns instead of rejecting long conversations.
MAX_HISTORY_CHARS = 8000


def bounded_conversation(request: ChatIn) -> list[dict[str, str]]:
    turns = request.conversation()
    total = sum(len(turn["content"]) for turn in turns)
    while total > MAX_HISTORY_CHARS:
        total -= len(turns.pop(0)["content"])
    # Anthropic expects a user turn first; never leave an orphan assistant response.
    while turns and turns[0]["role"] != "user":
        turns.pop(0)
    return turns


def server_conversation(request: ChatIn, owner: str | None) -> list[dict[str, str]]:
    # The only client-authored turn we trust is its current question. Older assistant and user
    # turns come from this process, never from a forged client transcript.
    if len(request.messages) == 1:
        sessions.forget(owner, request.language)  # the app started or cleared its conversation
    turns = [*sessions.history(owner, request.language), request.messages[-1].model_dump()]
    return bounded_conversation(ChatIn(messages=turns, language=request.language))


REFUSAL_TEXT = {
    "en": "I can't help with that request. Feel free to ask me something else.",
    "es": "No puedo ayudar con esa solicitud. Puedes preguntarme otra cosa.",
    "fa": "در مورد این درخواست کمک کرده نمی‌توانم. می‌توانید چیز دیگری بپرسید.",
    "zh": "这个请求我无法提供帮助。欢迎问我其他问题。",
    "vi": "Tôi không thể giúp yêu cầu này. Bạn có thể hỏi tôi điều khác.",
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
        # Tokens billed for the most recent call, read by the router to charge the daily budget.
        self.last_usage = 0

    @staticmethod
    def _tokens(usage: Any) -> int:
        return sum(getattr(usage, field, None) or 0 for field in
                   ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))

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
        self.last_usage = self._tokens(response.usage)
        # Check the stop reason before reading content: a declined request has no usable answer.
        if response.stop_reason == "refusal":
            raise Refused()
        return "\n".join(block.text for block in response.content if block.type == "text").strip()

    def stream(self, system: list[dict], messages: list[dict]) -> Iterator[str]:
        params = self._params(system, messages)
        open_stream = self.client.beta.messages.stream if "betas" in params else self.client.messages.stream
        with open_stream(**params) as stream:
            yield from stream.text_stream
            final = stream.get_final_message()
            self.last_usage = self._tokens(final.usage)
            if final.stop_reason == "refusal":
                raise Refused()


class AiPause:
    """A key with no credit, a revoked key or an unknown model fails every request the same way.
    After one such failure Claude is skipped for a while, so each message is not first slowed
    by a request that is bound to fail."""

    SECONDS = 600

    def __init__(self) -> None:
        self.until = 0.0

    def active(self) -> bool:
        return time.monotonic() < self.until

    def start(self) -> None:
        self.until = time.monotonic() + self.SECONDS

    def reset(self) -> None:
        self.until = 0.0


ai_pause = AiPause()


def _lasting(exc: Exception) -> bool:
    """True for failures that the next request would repeat (bad key, no credit, wrong model)."""
    if isinstance(exc, (anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.NotFoundError)):
        return True
    return isinstance(exc, anthropic.BadRequestError) and "credit balance" in str(exc).lower()


def get_llm() -> AnthropicLLM | None:
    """The Claude client, or None when chat should use basic search (no key, budget spent, or paused)."""
    settings = get_settings()
    if not settings.ai_enabled or ai_pause.active():
        return None
    if not budget.available():
        logger.warning("Daily chat token budget spent; answering in basic search mode")
        return None
    return AnthropicLLM(settings.anthropic_api_key, settings.claude_model)


def _charge(llm: Any) -> None:
    budget.charge(getattr(llm, "last_usage", 0))


def _basic(request: ChatIn) -> ChatOut:
    # The question before this one, so a follow-up like "what about on Sunday?" keeps its topic.
    previous = next((m.content for m in reversed(request.messages[:-1]) if m.role == "user"), None)
    reply, sources = grounding.local_answer(request.messages[-1].content, request.language, request.latitude, request.longitude, previous)
    return ChatOut(reply=reply, sources=sources, mode="basic", language=request.language)


def _refusal(request: ChatIn) -> ChatOut:
    return ChatOut(reply=REFUSAL_TEXT.get(request.language, REFUSAL_TEXT["en"]), sources=[], mode="ai", language=request.language)


def _log_failure(exc: Exception) -> None:
    if _lasting(exc):
        ai_pause.start()
        logger.warning("Claude is unavailable until the key, credit or model is fixed; using basic search for %s s", AiPause.SECONDS)
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


chat_limits = [
    Depends(rate_limit("chat", 12, 60)),
    Depends(rate_limit("chat-day", 150, 86400)),
    Depends(chat_global_limit),
]


@router.post("/chat", response_model=ChatOut, dependencies=chat_limits)
def chat(request: ChatIn, http_request: Request) -> ChatOut:
    owner = owner_from(http_request)
    turns = server_conversation(request, owner)
    llm = get_llm()
    if llm is None:
        return _basic(request)
    system = grounding.build_system(request.language)
    question = request.messages[-1].content
    try:
        reply = llm.complete(system, turns)
    except Refused:
        _charge(llm)
        return _refusal(request)
    except Exception as exc:  # the AI service is down or misconfigured: fall back to basic search
        _log_failure(exc)
        return _basic(request)
    _charge(llm)
    if not reply or not reply_is_acceptable(question, reply):
        return _basic(request)
    sessions.save(owner, request.language, turns, reply)
    # No sources: Claude answers from its own knowledge, not from ReSource's sourced data.
    return ChatOut(reply=reply, sources=[], mode="ai", language=request.language)


def _event(name: str, payload: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/chat/stream", dependencies=chat_limits)
def chat_stream(request: ChatIn, http_request: Request) -> StreamingResponse:
    """Server-sent events: `delta` {text} repeated, then `done` {sources, mode}.

    `reset` {text} replaces everything sent so far (used when an answer is withdrawn part-way).
    """
    owner = owner_from(http_request)
    turns = server_conversation(request, owner)
    llm = get_llm()

    def events() -> Iterator[str]:
        def finish(result: ChatOut, replace: bool) -> Iterator[str]:
            yield _event("reset" if replace else "delta", {"text": result.reply})
            yield _event("done", {"sources": result.sources, "mode": result.mode})

        if llm is None:
            yield from finish(_basic(request), replace=False)
            return
        try:
            system = grounding.build_system(request.language)
            # Buffer the answer until checked; unlisted Fremont contact details must not flash on screen.
            parts = list(llm.stream(system, turns))
            _charge(llm)
            reply = "".join(parts).strip()
            if not reply or not reply_is_acceptable(request.messages[-1].content, reply):
                yield from finish(_basic(request), replace=True)
                return
            sessions.save(owner, request.language, turns, reply)
            yield _event("delta", {"text": reply})
            yield _event("done", {"sources": [], "mode": "ai"})
        except Refused:
            _charge(llm)
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
    if not get_settings().ai_enabled or not budget.available() or ai_pause.active():
        return {"mode": "basic"}
    return {"mode": "ai", "model": get_settings().claude_model}
