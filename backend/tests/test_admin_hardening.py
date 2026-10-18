"""Regressions for admin attempt limits and write auditing."""
import json

from conftest import ADMIN, ALICE, CONSENT, report_body
from fastapi.testclient import TestClient
from settings import get_settings


def test_admin_auth_limits_five_failures_per_ip(client):
    bad_headers = {"X-Admin-Token": "incorrect-admin-passcode"}
    assert [client.get("/admin/me", headers=bad_headers).status_code for _ in range(5)] == [403] * 5
    limited = client.get("/admin/me", headers=bad_headers)
    assert limited.status_code == 429
    assert limited.json()["detail"] == "rate_limited"
    assert 1 <= int(limited.headers["Retry-After"]) <= 900
    with TestClient(client.app, client=("192.0.2.88", 1234)) as other_ip:
        assert other_ip.get("/admin/me", headers=bad_headers).status_code == 403


def test_successful_admin_writes_are_appended_to_audit_log(client):
    report = client.post("/reports", headers=ALICE, json=report_body()).json()
    assert client.post(f"/admin/reports/{report['id']}", headers=ADMIN,
                       json={"status": "verified"}).status_code == 200

    post = client.post("/posts", headers=ALICE, json={
        "body": "A helpful neighbor tip.", "area": "citywide", **CONSENT,
    }).json()
    assert client.post(f"/admin/posts/{post['id']}", headers=ADMIN,
                       json={"status": "approved"}).status_code == 200

    service = client.get("/services").json()[0]
    assert client.post(f"/admin/services/{service['id']}", headers=ADMIN,
                       json={"status": "closed"}).status_code == 200

    request = client.post("/deletion-requests", json={
        "contact_email": "resident@example.com",
        "details": "Please remove the account data associated with this request.",
        "relationship": "self", "consent": True,
    }).json()
    assert client.post(f"/admin/deletion-requests/{request['receipt_id']}", headers=ADMIN,
                       json={"status": "completed"}).status_code == 200

    path = get_settings().state_dir / "admin_audit.jsonl"
    records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
    assert [record["action"] for record in records] == [
        "report.moderate:verified", "post.moderate:approved", "service.update:closed",
        "deletion_request.close:completed",
    ]
    assert [record["resource_id"] for record in records] == [
        report["id"], post["id"], service["id"], request["receipt_id"],
    ]
    assert all(record["timestamp"].endswith("Z") for record in records)
