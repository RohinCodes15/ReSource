"""Resident routes remain device-token accessible regardless of ACCOUNT_REQUIRED."""
import time
from types import SimpleNamespace

import pytest
from conftest import ADMIN, ALICE, CONSENT, report_body

from settings import get_settings
from store import get_store


@pytest.fixture()
def account_mode(client, env, monkeypatch):
    def reject_remote_verification(token):
        pytest.fail("signed-in requests must not call Supabase Auth remotely")

    store = get_store()
    monkeypatch.setattr(store, "mode", "supabase")
    monkeypatch.setattr(store, "client", SimpleNamespace(auth=SimpleNamespace(get_user=reject_remote_verification)), raising=False)
    env.setenv("SUPABASE_URL", "https://example.supabase.co")
    env.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    env.setenv("SUPABASE_JWT_SECRET", "test-supabase-jwt-secret-at-least-32-bytes")

    def configure(required):
        env.setenv("ACCOUNT_REQUIRED", "true" if required else "false")
        get_settings.cache_clear()

    return configure


@pytest.mark.parametrize("required", [False, True])
@pytest.mark.parametrize("authorization", [None, "Bearer invalid-session", "Bearer expired-session", "Basic invalid"])
def test_resident_access_does_not_require_a_session(client, account_mode, required, authorization):
    account_mode(required)
    headers = {"Authorization": authorization} if authorization else {}
    response = client.get("/services", headers=headers)
    assert response.status_code == 200


@pytest.mark.parametrize("required", [False, True])
def test_signed_in_users_can_also_access_resident_routes(client, account_mode, required):
    account_mode(required)
    import jwt

    token = jwt.encode({
        "sub": "account-1",
        "iss": "https://example.supabase.co/auth/v1",
        "exp": int(time.time()) + 600,
        "app_metadata": {},
    }, "test-supabase-jwt-secret-at-least-32-bytes", algorithm="HS256")
    headers = {**ALICE, "Authorization": f"Bearer {token}"}
    assert client.get("/services", headers=headers).status_code == 200
    assert client.post("/reports", headers=headers, json=report_body()).status_code == 201


@pytest.mark.parametrize("required", [False, True])
def test_report_accepts_only_device_token_in_both_modes(client, account_mode, required):
    account_mode(required)
    response = client.post("/reports", headers=ALICE, json=report_body())
    assert response.status_code == 201


@pytest.mark.parametrize("required", [False, True])
def test_community_votes_and_chat_accept_only_device_token(client, account_mode, monkeypatch, required):
    account_mode(required)
    def must_not_verify(request):
        pytest.fail("resident action attempted session authentication")
    monkeypatch.setattr("security.signed_in_user", must_not_verify)
    post = client.post("/posts", headers=ALICE, json={
        "body": "A useful tip for neighbors.", "area": "citywide", **CONSENT,
    })
    assert post.status_code == 201
    post_id = post.json()["id"]
    assert post.json()["status"] == "pending"
    assert client.post(f"/admin/posts/{post_id}", headers=ADMIN, json={"status": "approved"}).status_code == 200
    vote = client.post(f"/posts/{post_id}/vote", headers=ALICE)
    assert vote.status_code == 200 and vote.json()["voted"] is True
    body = {"messages": [{"role": "user", "content": "Where can I get free food?"}]}
    assert client.post("/chat", headers=ALICE, json=body).status_code == 200
    assert client.post("/chat/stream", headers=ALICE, json=body).status_code == 200


@pytest.mark.parametrize("required", [False, True])
def test_all_resident_actions_work_with_only_device_token(client, account_mode, monkeypatch, required):
    account_mode(required)

    def must_not_verify(request):
        pytest.fail("resident action attempted session authentication")

    monkeypatch.setattr("security.signed_in_user", must_not_verify)
    headers = {"X-Client-Token": ALICE["X-Client-Token"]}
    assert "Authorization" not in headers

    report = client.post("/reports", headers=headers, json=report_body())
    assert report.status_code == 201
    assert report.json()["id"]

    post = client.post("/posts", headers=headers, json={
        "body": "A useful tip for neighbors.", "area": "citywide", **CONSENT,
    })
    assert post.status_code == 201
    post_id = post.json()["id"]
    assert post_id
    assert post.json()["status"] == "pending"
    assert client.post(f"/admin/posts/{post_id}", headers=ADMIN, json={"status": "approved"}).status_code == 200

    vote = client.post(f"/posts/{post_id}/vote", headers=headers)
    assert vote.status_code == 200
    assert vote.json()["voted"] is True

    chat = client.post("/chat", headers=headers, json={
        "messages": [{"role": "user", "content": "Where can I get free food?"}],
    })
    assert chat.status_code == 200
    assert "TCV Food Bank" in chat.json()["reply"]


@pytest.mark.parametrize("path,status", [("/health", 200), ("/config", 200),
                                        ("/privacy", 404), ("/terms", 404), ("/cookies", 404)])
@pytest.mark.parametrize("required", [False, True])
def test_each_exemption_skips_sign_in(client, account_mode, monkeypatch, path, status, required):
    account_mode(required)
    def must_not_verify(request):
        pytest.fail("exempt request attempted authentication")
    monkeypatch.setattr("security.signed_in_user", must_not_verify)
    assert client.get(path, headers={"Authorization": "Bearer expired-session"}).status_code == status


def test_cors_preflight_and_resident_response_have_cors_headers(client, account_mode):
    account_mode(True)
    origin = "http://localhost:8081"
    response = client.options("/services", headers={"Origin": origin,
                              "Access-Control-Request-Method": "GET",
                              "Access-Control-Request-Headers": "authorization"})
    assert response.status_code == 200
    response = client.get("/services", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
