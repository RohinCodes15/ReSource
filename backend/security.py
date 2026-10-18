"""Identity, admin checks, rate limiting and signed links.

Privacy design:
  * The app creates a random install token on the device and sends it as X-Client-Token.
    The server never stores it. It stores HMAC(salt, token) as `owner_hash`, which is enough
    to let someone delete their own post, vote once, or erase their data.
  * IP addresses are used only for rate limiting, are hashed before use and are kept in
    memory for the length of the rate-limit window. They are never written to disk.
    Uvicorn access logs redact the client address; provider/proxy logs are configured separately.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import re
import threading
import time
from collections import deque
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException, Request

from settings import get_settings

logger = logging.getLogger("resource.security")
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")


def _hmac(value: str) -> str:
    return hmac.new(get_settings().owner_salt.encode(), value.encode(), hashlib.sha256).hexdigest()


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    return header[7:].strip() if header.lower().startswith("bearer ") and len(header) > 7 else None


def signed_in_user(request: Request) -> dict[str, Any] | None:
    """The Supabase user behind the request's bearer token, or None. Cached per request."""
    if hasattr(request.state, "resource_user"):
        return request.state.resource_user
    user = None
    token = _bearer(request)
    if token and get_settings().use_supabase:
        from store import get_store

        store = get_store()
        if store.mode == "supabase":
            try:
                found = store.client.auth.get_user(token)
                if found and found.user:
                    user = {"id": found.user.id, "role": (found.user.app_metadata or {}).get("role"),
                            "email": getattr(found.user, "email", None)}
            except Exception:
                logger.info("Rejected an invalid or expired sign-in token")
    request.state.resource_user = user
    return user


def owner_from(request: Request) -> str | None:
    """Install/device identity only; sign-in sessions never determine data ownership."""
    token = request.headers.get("x-client-token", "")
    return _hmac(f"install:{token}") if TOKEN_RE.match(token) else None


def owners_from(request: Request) -> list[str]:
    """Export and delete use the same device identity as reports, posts and votes."""
    owner = owner_from(request)
    return [owner] if owner else []


def require_owners(request: Request) -> list[str]:
    owners = owners_from(request)
    if not owners:
        raise HTTPException(status_code=400, detail="missing_client_token")
    return owners


def require_owner(request: Request) -> str:
    owner = owner_from(request)
    if owner is None:
        raise HTTPException(status_code=400, detail="missing_client_token")
    return owner


def require_admin(request: Request) -> str:
    """Admin = the ADMIN_TOKEN header, or a signed-in Supabase user whose role is 'admin'."""
    configured = get_settings().admin_token
    supplied = request.headers.get("x-admin-token", "")
    if configured and supplied and hmac.compare_digest(configured.encode(), supplied.encode()):
        return "token"
    user = signed_in_user(request)
    if user and user.get("role") == "admin":
        return "user"
    # Count only failed authentication attempts. This guard is intentionally independent of
    # RATE_LIMIT_ENABLED, which is for disabling resident-facing limits during local tests.
    limiter.check(f"admin-auth:ip:{client_fingerprint(request)}", 5, 15 * 60)
    raise HTTPException(status_code=403, detail="admin_required")


def client_fingerprint(request: Request) -> str:
    """IP bucket identity, independent of caller-selected tokens; never retain the raw IP."""
    ip = request.client.host if request.client else "unknown"
    if get_settings().trust_proxy:
        ip = request.headers.get("x-forwarded-for", ip).split(",")[-1].strip() or ip
    return _hmac(f"ip:{ip}")[:24]


class RateLimiter:
    """Sliding-window limiter held in memory (one API process; see docs/SECURITY.md)."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._windows: dict[str, int] = {}
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> None:
        self.check_many([(key, limit, window_seconds)])

    def check_many(self, buckets: list[tuple[str, int, int]]) -> None:
        """Check and debit all buckets atomically; a rejected call consumes none of them."""
        now = time.monotonic()
        with self._lock:
            retry_after = 0
            for key, limit, window_seconds in buckets:
                hits = self._hits.setdefault(key, deque())
                self._windows[key] = window_seconds
                while hits and now - hits[0] >= window_seconds:
                    hits.popleft()
                if len(hits) >= limit:
                    retry_after = max(retry_after, int(window_seconds - (now - hits[0])) + 1)
            if retry_after:
                raise HTTPException(status_code=429, detail="rate_limited", headers={"Retry-After": str(retry_after)})
            for key, _, _ in buckets:
                self._hits[key].append(now)
            if len(self._hits) > 20000:  # keep memory bounded: forget callers with no recent hits
                for stale in [k for k, v in self._hits.items() if not v or now - v[-1] >= self._windows[k]]:
                    del self._hits[stale]
                    del self._windows[stale]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
            self._windows.clear()


limiter = RateLimiter()


def rate_limit(bucket: str, limit: int, window_seconds: int) -> Callable[[Request], None]:
    """Always charge an IP bucket, plus an owner/token bucket when one is present."""

    def dependency(request: Request) -> None:
        if get_settings().rate_limit_enabled:
            limiter.check(f"{bucket}:ip:{client_fingerprint(request)}", limit, window_seconds)
            owner = owner_from(request)
            if owner:
                limiter.check(f"{bucket}:owner:{owner}", limit, window_seconds)

    return dependency


def chat_global_limit(request: Request) -> None:
    """One rolling 24-hour ceiling shared by JSON and streaming chat in this process.

    Run one API worker; multiple workers require a shared counter store such as Redis.
    """
    settings = get_settings()
    if settings.rate_limit_enabled:
        limiter.check("chat:global:day", settings.chat_global_daily_limit, 86400)


def sign(value: str) -> str:
    """URL-safe token carrying `value` plus a signature (used for email unsubscribe links)."""
    body = base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")
    return f"{body}.{_hmac(f'link:{value}')[:32]}"


def unsign(token: str) -> str | None:
    try:
        body, signature = token.split(".", 1)
        value = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)).decode()
    except (ValueError, UnicodeDecodeError):
        return None
    return value if hmac.compare_digest(signature, _hmac(f"link:{value}")[:32]) else None
