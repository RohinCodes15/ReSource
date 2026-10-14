"""Shared fixtures. Every test runs against local mode with its own empty state folder."""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

ALICE = {"X-Client-Token": "test-install-token-alice-01"}
BOB = {"X-Client-Token": "test-install-token-bob-0002"}
CAROL = {"X-Client-Token": "test-install-token-carol-03"}
DAVE = {"X-Client-Token": "test-install-token-dave-004"}
ADMIN = {"X-Admin-Token": "test-admin-token"}
CONSENT = {"consent": True, "age_confirmed": True}


@pytest.fixture()
def env(tmp_path, monkeypatch):
    """Clean environment: no Supabase, no AI key, no email, rate limiting off."""
    for name in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "SMTP_HOST", "EMAIL_FROM", "PUBLIC_API_URL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("LOCAL_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("ADMIN_TOKEN", "test-admin-token")
    monkeypatch.setenv("OWNER_HASH_SALT", "test-salt")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "0")
    return monkeypatch


@pytest.fixture()
def client(env):
    import security
    import store

    store.reset_store()
    security.limiter.reset()
    from community_guard import guard

    guard.reset()
    import main

    with TestClient(main.app) as test_client:
        yield test_client
    store.reset_store()


def restart():
    """Simulate an API restart: drop the in-memory store so it reloads from the state file."""
    import security
    import store

    store.reset_store()
    security.limiter.reset()
    from community_guard import guard

    guard.reset()


def report_body(**overrides):
    body = {"service_id": "svc-pavement", "service_name": "Street pavement maintenance", "area": "94538",
            "description": "The potholes on our block have not been repaired.", "impact_level": "medium", **CONSENT}
    body.update(overrides)
    return body


def png_bytes(size=(40, 30)) -> bytes:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", size, (27, 58, 107)).save(buffer, format="PNG")
    return buffer.getvalue()
