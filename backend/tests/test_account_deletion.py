"""Account deletion uses verified Auth identity and never erases install-owned data."""
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from conftest import ALICE, report_body
from httpx import ConnectError
from supabase_auth.errors import AuthApiError

from settings import get_settings
from store import get_store

USER_ID = "11111111-1111-4111-8111-111111111111"


@pytest.fixture()
def auth_account(client, env, monkeypatch):
    store = get_store()
    user = SimpleNamespace(id=USER_ID, app_metadata={})
    verify = Mock(side_effect=lambda token: SimpleNamespace(user=user if token == "valid-session" else None))
    delete = Mock()
    monkeypatch.setattr(store, "mode", "supabase")
    monkeypatch.setattr(store, "client", SimpleNamespace(auth=SimpleNamespace(
        get_user=verify, admin=SimpleNamespace(delete_user=delete))), raising=False)
    env.setenv("SUPABASE_URL", "https://example.supabase.co")
    env.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    env.setenv("ACCOUNT_REQUIRED", "false")
    get_settings.cache_clear()
    return store, verify, delete


@pytest.mark.parametrize("required", [False, True])
@pytest.mark.parametrize("authorization", [None, "Bearer invalid-session", "Basic invalid"])
def test_account_deletion_always_requires_valid_sign_in(client, env, auth_account, required, authorization):
    env.setenv("ACCOUNT_REQUIRED", str(required))
    get_settings.cache_clear()
    headers = {**ALICE, **({"Authorization": authorization} if authorization else {})}
    response = client.delete("/me/account", headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "sign_in_required"
    assert response.headers["www-authenticate"] == "Bearer"
    auth_account[2].assert_not_called()


@pytest.mark.parametrize("required", [False, True])
def test_deletes_only_verified_account_and_preserves_reports(client, env, auth_account, monkeypatch, required):
    store, verify, delete = auth_account
    report = client.post("/reports", json=report_body(), headers=ALICE).json()
    post = store.insert("posts", {"body": "A device-owned tip", "owner_hash": "install-owner", "status": "approved"})
    vote = store.insert("post_votes", {"post_id": post["id"], "owner_hash": "install-owner"})
    before = {table: store.list(table) for table in ("reports", "posts", "post_votes", "consent_records")}
    env.setenv("ACCOUNT_REQUIRED", str(required))
    get_settings.cache_clear()
    # No deletion from a device-owned table or report photo store is permitted.
    monkeypatch.setattr(store, "delete", Mock(side_effect=AssertionError("resident data must survive")))
    monkeypatch.setattr(store, "delete_file", Mock(side_effect=AssertionError("photos must survive")))
    response = client.delete("/me/account?user_id=someone-else", headers={"Authorization": "Bearer valid-session"})
    assert response.status_code == 200
    assert response.json()["account_deleted"] is True
    assert response.json()["reports_deleted"] is False
    assert response.json()["completed_at"]
    delete.assert_called_once_with(USER_ID, should_soft_delete=False)
    verify.assert_called_once_with("valid-session")
    assert {table: store.list(table) for table in before} == before
    assert store.get("reports", report["id"])
    assert store.get("post_votes", vote["id"])


def test_account_deletion_rate_limit(client, env, auth_account):
    from security import limiter

    env.setenv("RATE_LIMIT_ENABLED", "true")
    get_settings.cache_clear()
    limiter.reset()
    delete = auth_account[2]
    delete.side_effect = AuthApiError("provider unavailable", 503, None)
    responses = [client.delete("/me/account", headers={"Authorization": "Bearer valid-session"}) for _ in range(4)]
    assert [response.status_code for response in responses] == [502, 502, 502, 429]
    assert int(responses[-1].headers["retry-after"]) > 0
    assert delete.call_count == 3


@pytest.mark.parametrize("provider_status,expected,error", [
    (404, 404, "account_not_found"),
    (401, 503, "account_deletion_unavailable"),
    (403, 503, "account_deletion_unavailable"),
    (500, 502, "account_deletion_failed"),
])
def test_provider_failures_are_clear_and_do_not_leak_details(client, auth_account, provider_status, expected, error):
    failure = AuthApiError("private.email@example.test secret-provider-detail", provider_status, None)
    auth_account[2].side_effect = failure
    response = client.delete("/me/account", headers={"Authorization": "Bearer valid-session"})
    assert response.status_code == expected
    assert response.json() == {"detail": error}


def test_account_deletion_network_error_is_clear(client, auth_account):
    auth_account[2].side_effect = ConnectError("private provider details")
    response = client.delete("/me/account", headers={"Authorization": "Bearer valid-session"})
    assert response.status_code == 502
    assert response.json() == {"detail": "account_deletion_failed"}


def test_account_deletion_unavailable_without_live_auth_backend(client, auth_account, monkeypatch):
    monkeypatch.setattr("routers.account.signed_in_user", lambda request: {"id": USER_ID})
    monkeypatch.setattr(auth_account[0], "mode", "local")
    response = client.delete("/me/account", headers={"Authorization": "Bearer valid-session"})
    assert response.status_code == 503
    assert response.json()["detail"] == "account_deletion_unavailable"
    auth_account[2].assert_not_called()
