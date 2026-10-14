"""S7: no address collection without a sender/confirmation flow; links need confirmation."""
from types import SimpleNamespace

from conftest import ALICE, BOB, CONSENT

from security import sign
from store import get_store


def test_email_writer_cannot_be_enabled_accidentally_or_reassign_an_address(client, monkeypatch):
    store = get_store()
    original = store.insert("email_subscriptions", {"email": "resident@example.test", "owner_hash": "original-owner", "areas": [], "categories": []})
    monkeypatch.setattr("routers.account.get_settings", lambda: SimpleNamespace(email_enabled=True))
    for headers in (ALICE, BOB):
        response = client.post("/email/subscribe", headers=headers, json={
            "email": original["email"], "areas": [], "categories": ["budget"], **CONSENT,
        })
        assert response.status_code == 503
    assert store.get("email_subscriptions", original["id"]) == original
    assert store.list("consent_records") == []


def test_unsubscribe_get_only_confirms_and_post_removes(client):
    store = get_store()
    row = store.insert("email_subscriptions", {"email": "resident@example.test", "owner_hash": "original-owner", "areas": [], "categories": []})
    token = sign(row["id"])
    page = client.get("/email/unsubscribe", params={"token": token})
    assert page.status_code == 200
    assert 'method="post"' in page.text
    assert store.get("email_subscriptions", row["id"])
    assert client.post("/email/unsubscribe", params={"token": token}).json()["unsubscribed"]
    assert store.get("email_subscriptions", row["id"]) is None
