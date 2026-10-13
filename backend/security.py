"""Identity, admin checks, rate limiting and signed links.

Privacy design:
  * The app creates a random install token on the device and sends it as X-Client-Token.
    The server never stores it. It stores HMAC(salt, token) as `owner_hash`, which is enough
    to let someone delete their own post, vote once, or erase their data.
  * IP addresses are used only for rate limiting, are hashed before use and are kept in
    memory for the length of the rate-limit window. They are never written to disk.
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
                    user = {"id": found.user.id, "role": (found.user.app_metadata or {}).get("role")}
            except Exception:
                logger.info("Rejected an invalid or expired sign-in token")
    request.state.resource_user = user
    return user


def owner_from(request: Request) -> str | None:
    """Stable, non-reversible id for whoever sent the request; None for a fully anonymous one."""
    user = signed_in_user(request)
    if user:
        return _hmac(f"user:{user['id']}")
    token = request.headers.get("x-client-token", "")
    return _hmac(f"install:{token}") if TOKEN_RE.match(token) else None


def owners_from(request: Request) -> list[str]:
    """Every id this request can prove it owns: the signed-in account and this install. Export and
    delete use both, so what someone posted before signing in is not left behind."""
    owners = []
    user = signed_in_user(request)
    if user:
        owners.append(_hmac(f"user:{user['id']}"))
    token = request.headers.get("x-client-token", "")
    if TOKEN_RE.match(token):
        owners.append(_hmac(f"install:{token}"))
    return owners


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
    raise HTTPException(status_code=403, detail="admin_required")


def client_fingerprint(request: Request) -> str:
    """Short hash that tells callers apart for rate limiting without keeping their IP."""
    owner = owner_from(request)
    if owner:
        return owner[:24]
    ip = request.client.host if request.client else "unknown"
    if get_settings().trust_proxy:
        ip = request.headers.get("x-forwarded-for", ip).split(",")[0].strip() or ip
    return _hmac(f"ip:{ip}")[:24]


class RateLimiter:
    """Sliding-window limiter held in memory (one API process; see docs/SECURITY.md)."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] > window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                retry_after = max(1, int(window_seconds - (now - hits[0])) + 1)
                raise HTTPException(status_code=429, detail="rate_limited", headers={"Retry-After": str(retry_after)})
            hits.append(now)
            if len(self._hits) > 20000:  # keep memory bounded: forget callers with no recent hits
                for stale in [k for k, v in self._hits.items() if not v or now - v[-1] > 3600]:
                    del self._hits[stale]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def rate_limit(bucket: str, limit: int, window_seconds: int) -> Callable[[Request], None]:
    """FastAPI dependency: at most `limit` calls per `window_seconds` for each caller."""

    def dependency(request: Request) -> None:
        if get_settings().rate_limit_enabled:
            limiter.check(f"{bucket}:{client_fingerprint(request)}", limit, window_seconds)

    return dependency


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
