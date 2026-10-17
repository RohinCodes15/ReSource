"""Resident routes remain device-token accessible regardless of ACCOUNT_REQUIRED."""
from types import SimpleNamespace

import pytest
from conftest import ALICE, CONSENT, report_body

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
def test_resident_access_does_not_require_a_session(client, account_mode, required, authorization):
    account_mode(required)
    headers = {"Authorization": authorization} if authorization else {}
    response = client.get("/services", headers=headers)
    assert response.status_code == 200


@pytest.mark.parametrize("required", [False, True])
def test_signed_in_users_can_also_access_resident_routes(client, account_mode, required):
    account_mode(required)
    headers = {**ALICE, "Authorization": "Bearer valid-session"}
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
    vote = client.post(f"/posts/{post.json()['id']}/vote", headers=ALICE)
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
