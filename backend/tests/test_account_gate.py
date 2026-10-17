"""Optional account requirement, verified sessions, and public exemptions."""
from types import SimpleNamespace

import pytest
from conftest import ALICE, report_body

from settings import get_settings
from store import get_store


@pytest.fixture()
def account_mode(client, env, monkeypatch):
    def verify(token):
        if token != "valid-session":
            raise ValueError("invalid or expired session")
        return SimpleNamespace(user=SimpleNamespace(id="account-1", app_metadata={}))

    store = get_store()
    monkeypatch.setattr(store, "mode", "supabase")
    monkeypatch.setattr(store, "client", SimpleNamespace(auth=SimpleNamespace(get_user=verify)), raising=False)
    env.setenv("SUPABASE_URL", "https://example.supabase.co")
    env.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")

    def configure(required):
        env.setenv("ACCOUNT_REQUIRED", "true" if required else "false")
        get_settings.cache_clear()

    return configure


@pytest.mark.parametrize("required", [False, True])
@pytest.mark.parametrize("authorization", [None, "Bearer invalid-session", "Bearer expired-session", "Basic invalid"])
def test_unsigned_or_invalid_sessions_respect_account_mode(client, account_mode, required, authorization):
    account_mode(required)
    headers = {"Authorization": authorization} if authorization else {}
    response = client.get("/services", headers=headers)
    assert response.status_code == (401 if required else 200)
    if required:
        assert response.json() == {"detail": "sign_in_required"}
        assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("required", [False, True])
def test_valid_sign_in_can_access_protected_routes(client, account_mode, required):
    account_mode(required)
    headers = {**ALICE, "Authorization": "Bearer valid-session"}
    assert client.get("/services", headers=headers).status_code == 200
    assert client.post("/reports", headers=headers, json=report_body()).status_code == 201


@pytest.mark.parametrize("required", [False, True])
def test_write_gate_preserves_open_mode(client, account_mode, required):
    account_mode(required)
    response = client.post("/reports", headers=ALICE, json=report_body())
    assert response.status_code == (401 if required else 201)


@pytest.mark.parametrize("path,status", [("/health", 200), ("/config", 200),
                                        ("/privacy", 404), ("/terms", 404), ("/cookies", 404)])
@pytest.mark.parametrize("required", [False, True])
def test_each_exemption_skips_sign_in(client, account_mode, monkeypatch, path, status, required):
    account_mode(required)
    def must_not_verify(request):
        pytest.fail("exempt request attempted authentication")
    monkeypatch.setattr("main.signed_in_user", must_not_verify)
    assert client.get(path, headers={"Authorization": "Bearer expired-session"}).status_code == status


def test_cors_preflight_passes_and_401_has_cors_headers(client, account_mode):
    account_mode(True)
    origin = "http://localhost:8081"
    response = client.options("/services", headers={"Origin": origin,
                              "Access-Control-Request-Method": "GET",
                              "Access-Control-Request-Headers": "authorization"})
    assert response.status_code == 200
    response = client.get("/services", headers={"Origin": origin})
    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == origin
