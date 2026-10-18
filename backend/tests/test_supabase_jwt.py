"""Local Supabase JWT verification regressions."""
from __future__ import annotations

import logging
import time
from types import SimpleNamespace

import jwt
import pytest
from starlette.requests import Request

from settings import get_settings
from store import get_store

JWT_SECRET = "test-supabase-jwt-secret-at-least-32-bytes"


def test_signed_in_user_verifies_jwt_locally_without_supabase_auth(client, env, monkeypatch):
    import security

    env.setenv("SUPABASE_URL", "https://example.supabase.co")
    env.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
    env.setenv("SUPABASE_JWT_SECRET", JWT_SECRET)
    get_settings.cache_clear()
    store = get_store()
    monkeypatch.setattr(store, "mode", "supabase")

    def remote_auth_must_not_run(token):
        pytest.fail("signed_in_user must verify the JWT locally")

    monkeypatch.setattr(store, "client", SimpleNamespace(auth=SimpleNamespace(get_user=remote_auth_must_not_run)), raising=False)
    token = jwt.encode({
        "sub": "resident-123",
        "iss": "https://example.supabase.co/auth/v1",
        "exp": int(time.time()) + 600,
        "email": "resident@example.com",
        "app_metadata": {"role": "admin"},
    }, JWT_SECRET, algorithm="HS256")
    request = Request({"type": "http", "headers": [(b"authorization", f"Bearer {token}".encode())]})
    assert security.signed_in_user(request) == {
        "id": "resident-123", "role": "admin", "email": "resident@example.com",
    }


def test_invalid_local_jwt_is_logged_as_bad_token(client, env, monkeypatch, caplog):
    import security

    env.setenv("SUPABASE_URL", "https://example.supabase.co")
    env.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
    env.setenv("SUPABASE_JWT_SECRET", JWT_SECRET)
    get_settings.cache_clear()
    caplog.set_level(logging.INFO, logger="resource.security")
    store = get_store()
    monkeypatch.setattr(store, "mode", "supabase")
    req = Request({"type": "http", "headers": [(b"authorization", b"Bearer not-a-jwt")]})
    assert security.signed_in_user(req) is None
    assert "Rejected invalid Supabase sign-in JWT" in caplog.text
    assert "DecodeError" in caplog.text


def test_missing_jwt_verification_key_is_logged_as_verifier_unavailable(client, env, caplog):
    import security

    env.setenv("SUPABASE_URL", "https://example.supabase.co")
    env.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
    env.delenv("SUPABASE_JWT_SECRET", raising=False)
    get_settings.cache_clear()
    caplog.set_level(logging.ERROR, logger="resource.security")
    req = Request({"type": "http", "headers": [(b"authorization", b"Bearer any-token")]})
    assert security.signed_in_user(req) is None
    assert "SUPABASE_JWT_SECRET is not configured" in caplog.text
