"""S3: rotating install tokens must not manufacture votes or a flag quorum."""
from conftest import ADMIN, ALICE, report_body
from fastapi.testclient import TestClient

from store import get_store


def test_same_ip_cannot_hide_or_stuff_votes(client):
    store = get_store()
    row = store.insert("posts", {"body": "A helpful tip", "status": "approved", "upvotes": 0})
    for i in range(5):
        headers = {"X-Client-Token": f"invented-install-token-{i:03d}"}
        assert client.post(f"/posts/{row['id']}/flag", headers=headers).status_code == 200
        assert client.post(f"/posts/{row['id']}/vote", headers=headers).status_code == (200 if i == 0 else 409)
    assert store.get("posts", row["id"])["status"] == "approved"
    assert store.get("posts", row["id"])["upvotes"] == 1
    assert next(p for p in client.get("/posts").json() if p["id"] == row["id"])["upvotes_approximate"] is True


def test_same_owner_on_many_ips_is_not_a_quorum(client):
    store = get_store()
    row = store.insert("posts", {"body": "A helpful tip", "status": "approved", "upvotes": 0})
    for i in range(4):
        with TestClient(client.app, client=(f"192.0.2.{i+1}", 1234)) as other:
            assert other.post(f"/posts/{row['id']}/flag", headers=ALICE).status_code == 200
    assert store.get("posts", row["id"])["status"] == "approved"
    assert store.count("post_flags", {"post_id": row["id"]}) == 1


def test_public_report_count_excludes_pending_and_rejected(client):
    pending = client.post("/reports", json=report_body(), headers=ALICE).json()
    assert client.get("/stats").json()["reports_total"] == 0
    client.post(f"/admin/reports/{pending['id']}", json={"status": "rejected"}, headers=ADMIN)
    assert client.get("/stats").json()["reports_total"] == 0
    client.post(f"/admin/reports/{pending['id']}", json={"status": "verified"}, headers=ADMIN)
    assert client.get("/stats").json()["reports_total"] == 1
