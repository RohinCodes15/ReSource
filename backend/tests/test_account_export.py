"""Account export contains verified email and own consent only; never report data."""
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from conftest import ALICE, report_body

from settings import get_settings
from store import StoreError, get_store

USER_ID = "11111111-1111-4111-8111-111111111111"


@pytest.fixture()
def account_export(client, env, monkeypatch):
    store = get_store()
    original_list = store.list
    report = client.post("/reports", headers=ALICE, json=report_body()).json()
    user = {"id": USER_ID, "email": "resident@example.test"}
    monkeypatch.setattr(store, "mode", "supabase")
    monkeypatch.setattr(store, "client", SimpleNamespace(auth=SimpleNamespace(get_user=Mock())), raising=False)
    monkeypatch.setattr("routers.account.signed_in_user", lambda request: user if request.headers.get("authorization") == "Bearer valid-session" else None)
    records = [
        {"user_id": USER_ID, "policy_version": "2026-10-16", "accepted_at": "2026-10-17T10:00:00Z", "private": "hidden"},
        {"user_id": "another-account", "policy_version": "other-policy", "accepted_at": "2026-10-17T11:00:00Z"},
    ]

    def list_consents(table, filters, **kwargs):
        assert table == "account_consents", "account export must not query reports or other device data"
        return [row for row in records if row["user_id"] == filters["user_id"]]

    query = Mock(side_effect=list_consents)
    monkeypatch.setattr(store, "list", query)
    env.setenv("SUPABASE_URL", "https://example.supabase.co")
    env.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    env.setenv("ACCOUNT_REQUIRED", "false")
    get_settings.cache_clear()
    return store, query, records, report, original_list


@pytest.mark.parametrize("required", [False, True])
def test_account_export_contains_only_verified_email_and_own_consents(client, env, account_export, required):
    store, query, _, report, original_list = account_export
    before = original_list("reports")
    env.setenv("ACCOUNT_REQUIRED", str(required))
    get_settings.cache_clear()
    response = client.get("/me/account/export?user_id=another-account&email=forged@example.test",
                          headers={"Authorization": "Bearer valid-session"})
    assert response.status_code == 200
    assert response.json() == {"email": "resident@example.test", "consents": [
        {"policy_version": "2026-10-16", "accepted_at": "2026-10-17T10:00:00Z"},
    ]}
    query.assert_called_once_with("account_consents", {"user_id": USER_ID}, order="accepted_at", desc=True)
    assert original_list("reports") == before
    assert store.get("reports", report["id"])


@pytest.mark.parametrize("required", [False, True])
@pytest.mark.parametrize("authorization", [None, "Bearer invalid-session"])
def test_account_export_requires_sign_in(client, env, account_export, required, authorization):
    env.setenv("ACCOUNT_REQUIRED", str(required))
    get_settings.cache_clear()
    response = client.get("/me/account/export", headers={**ALICE, **({"Authorization": authorization} if authorization else {})})
    assert response.status_code == 401
    assert response.json()["detail"] == "sign_in_required"
    account_export[1].assert_not_called()


def test_account_export_without_consent_returns_empty_list(client, account_export):
    account_export[2].clear()
    response = client.get("/me/account/export", headers={"Authorization": "Bearer valid-session"})
    assert response.json() == {"email": "resident@example.test", "consents": []}


def test_account_export_database_failure_is_not_reported_as_empty_consent(client, account_export):
    account_export[1].side_effect = StoreError("private database detail")
    response = client.get("/me/account/export", headers={"Authorization": "Bearer valid-session"})
    assert response.status_code == 502
    assert response.json() == {"detail": "database_unavailable"}
