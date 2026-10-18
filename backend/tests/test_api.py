"""Route tests: catalog, distance sorting, validation, moderation, privacy, admin."""
from __future__ import annotations

from conftest import (
    ADMIN,
    ALICE,
    BOB,
    CAROL,
    CONSENT,
    DAVE,
    png_bytes,
    report_body,
    restart,
)
from fastapi.testclient import TestClient

# ---- Catalog --------------------------------------------------------------------------------

def test_health_reports_local_mode(client):
    assert client.get("/health").json() == {"status": "ok", "mode": "local", "ai": False}
    config = client.get("/config").json()
    assert config["mode"] == "local" and config["email_enabled"] is False and config["policy_version"]


def test_every_service_carries_its_source(client):
    services = client.get("/services").json()
    assert len(services) >= 8
    for service in services:
        assert service["source_url"].startswith("https://"), service["id"]
        assert service["retrieved"] and service["status"] in ("open", "reduced", "closed")
        assert "sample" not in service["summary"].lower()


def test_services_filter_by_status_category_and_text(client):
    reduced = client.get("/services", params={"status": "reduced"}).json()
    assert reduced and all(s["status"] == "reduced" for s in reduced)
    assert all(s["category"] == "seniors" for s in client.get("/services", params={"category": "seniors"}).json())
    assert [s["id"] for s in client.get("/services", params={"q": "detention"}).json()] == ["svc-detention"]
    assert client.get("/services", params={"status": "bogus"}).status_code == 422
    assert client.get("/services/does-not-exist").status_code == 404


def test_resources_are_sorted_by_distance_when_a_position_is_given(client):
    rows = client.get("/resources", params={"lat": 37.5773, "lng": -121.9806}).json()  # by Niles Library
    assert rows[0]["id"] == "res-library-niles" and rows[0]["distance_miles"] < 0.1
    placed = [r["distance_miles"] for r in rows if r["distance_miles"] is not None]
    assert placed == sorted(placed)
    # Phone lines have no position: they keep distance None and come after every placed row.
    unplaced = [i for i, r in enumerate(rows) if r["distance_miles"] is None]
    assert unplaced and min(unplaced) == len(placed)


def test_resources_without_a_position_are_by_name_with_no_distance(client):
    rows = client.get("/resources").json()
    assert all(r["distance_miles"] is None for r in rows)
    assert [r["name"] for r in rows] == sorted(r["name"] for r in rows)
    assert client.get("/resources", params={"lat": 37.5}).status_code == 422
    assert {r["category"] for r in client.get("/resources", params={"category": "Food"}).json()} == {"Food"}


def test_zip_lookup(client):
    assert client.get("/zips/94539").json()["label"] == "Mission San Jose & Warm Springs"
    assert client.get("/zips/94537").json()["kind"] == "po_box"
    outside = client.get("/zips/94102")
    assert outside.status_code == 404 and outside.json()["detail"] == "zip_not_in_fremont"


def test_council_roster_has_no_invented_votes(client):
    council = client.get("/council").json()
    assert len(council["members"]) == 7
    assert all(member["email"].endswith("@fremont.gov") for member in council["members"])
    assert all(vote["member_votes"] == {} and vote["source_url"] for vote in council["votes"])
    assert {vote["tally"] for vote in council["votes"]} <= {"unverified", "reported_unanimous"}


def test_budget_figures_all_point_at_a_source(client):
    budget = client.get("/budget").json()
    for item in budget["headline"] + budget["reductions"] + budget["context"] + budget["timeline"]:
        assert item["source"] in budget["sources"]


def test_stats_are_real_counts(client):
    assert client.get("/stats").json()["reports_total"] == 0
    report = client.post("/reports", json=report_body(), headers=ALICE).json()
    stats = client.get("/stats").json()
    assert (stats["reports_total"], stats["reports_verified"]) == (0, 0)
    client.post(f"/admin/reports/{report['id']}", json={"status": "verified"}, headers=ADMIN)
    assert client.get("/stats").json()["reports_verified"] == 1
    assert stats["posts"] == 0  # the labeled starter posts are not counted as community activity


def test_security_headers_and_cors(client):
    response = client.get("/health", headers={"Origin": "http://localhost:8081"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    assert "access-control-allow-origin" not in client.get("/health", headers={"Origin": "https://evil.example"}).headers


# ---- Reports --------------------------------------------------------------------------------

def test_report_starts_pending_and_scrubs_personal_details(client):
    body = report_body(description="Call me at (510) 555-0142 or sam@example.com, I live at 123 Main St. Dial 211 too.")
    response = client.post("/reports", json=body, headers=ALICE)
    assert response.status_code == 201
    report = response.json()
    assert report["status"] == "pending" and "owner_hash" not in report
    assert "555" not in report["description"] and "example.com" not in report["description"] and "Main St" not in report["description"]
    assert "211" in report["description"]
    assert set(report["pii_removed"]) == {"email", "phone", "address"}


def test_report_validation(client):
    def errors(**overrides):
        response = client.post("/reports", json=report_body(**overrides), headers=ALICE)
        return response.status_code, [e["message"] for e in response.json().get("errors", [])]

    assert errors(consent=False) == (422, ["consent_required"])
    assert errors(age_confirmed=False) == (422, ["age_confirmation_required"])
    assert errors(description="too short")[0] == 422
    assert errors(impact_level="extreme")[0] == 422
    assert errors(area="90210")[0] == 422
    assert errors(unexpected="field")[0] == 422
    assert client.post("/reports", json=report_body(service_id="svc-nope"), headers=ALICE).json()["detail"] == "unknown_service"
    assert client.post("/reports", json=report_body(website="http://spam.example"), headers=ALICE).json()["detail"] == "spam_detected"
    assert client.post("/reports", json=report_body()).json()["detail"] == "missing_client_token"
    assert client.get("/stats").json()["reports_total"] == 0


def test_report_rate_limit(client, env):
    env.setenv("RATE_LIMIT_ENABLED", "1")
    restart()
    codes = [client.post("/reports", json=report_body(), headers=ALICE).status_code for _ in range(6)]
    assert codes == [201] * 5 + [429]
    assert client.post("/reports", json=report_body(), headers=BOB).status_code == 429  # changing token cannot bypass IP limit


def test_report_photo_rules(client):
    report = client.post("/reports", json=report_body(), headers=ALICE).json()
    url = f"/reports/{report['id']}/photo"
    ok = client.post(url, files={"photo": ("street.png", png_bytes(), "image/png")}, headers=ALICE)
    assert ok.status_code == 200 and ok.json()["has_photo"] is True
    assert client.get("/reports/mine", headers=ALICE).json()[0]["has_photo"] is True
    assert client.post(url, files={"photo": ("street.png", png_bytes(), "image/png")}, headers=BOB).status_code == 404
    assert client.post(url, files={"photo": ("notes.txt", b"not an image", "image/png")}, headers=ALICE).status_code == 415
    assert client.post(url, files={"photo": ("big.png", b"0" * (5 * 1024 * 1024 + 1), "image/png")}, headers=ALICE).status_code == 413
    # 30,000,000 pixels of one color is a tiny file but a huge bitmap: refused before decoding.
    assert client.post(url, files={"photo": ("huge.png", png_bytes((6000, 5000)), "image/png")}, headers=ALICE).status_code == 413
    # A moderator can look at the photo; nobody else can.
    assert client.get(f"/admin/reports/{report['id']}/photo").status_code == 403
    seen = client.get(f"/admin/reports/{report['id']}/photo", headers=ADMIN)
    assert seen.status_code == 200 and seen.headers["content-type"] == "image/jpeg" and seen.content[:2] == b"\xff\xd8"
    assert client.delete(url, headers=ALICE).json()["has_photo"] is False
    assert client.get(f"/admin/reports/{report['id']}/photo", headers=ADMIN).status_code == 404


# ---- Community board --------------------------------------------------------------------------

def post(client, headers, body="The food bank on Joseph St was quick today."):
    return client.post("/posts", json={"body": body, "area": "94536", **CONSENT}, headers=headers)


def test_post_vote_once_flag_and_delete(client):
    created = post(client, ALICE).json()
    assert created["status"] == "approved" and created["mine"] is True and "owner_hash" not in created
    post_id = created["id"]

    assert client.post(f"/posts/{post_id}/vote", headers=BOB).json() == {"id": post_id, "upvotes": 1, "voted": True}
    assert TestClient(client.app, client=("192.0.2.3", 1234)).post(f"/posts/{post_id}/vote", headers=CAROL).json()["upvotes"] == 2
    assert client.post(f"/posts/{post_id}/vote", headers=BOB).json() == {"id": post_id, "upvotes": 1, "voted": False}

    listed = {p["id"]: p for p in client.get("/posts", headers=CAROL).json()}
    assert listed[post_id]["voted"] is True and listed[post_id]["mine"] is False
    assert any(p["is_sample"] for p in listed.values())  # starter posts are labeled, never disguised

    assert client.delete(f"/posts/{post_id}", headers=BOB).status_code == 404
    assert client.delete(f"/posts/{post_id}", headers=ALICE).json()["deleted"] is True
    assert post_id not in [p["id"] for p in client.get("/posts").json()]


def test_three_flags_hide_a_post_until_reviewed(client):
    post_id = post(client, ALICE).json()["id"]
    for flagger in (BOB, BOB, CAROL):  # the same person flagging twice counts once
        TestClient(client.app, client=("192.0.2.2" if flagger == BOB else "192.0.2.3", 1234)).post(f"/posts/{post_id}/flag", headers=flagger)
    assert post_id in [p["id"] for p in client.get("/posts").json()]
    TestClient(client.app, client=("192.0.2.4", 1234)).post(f"/posts/{post_id}/flag", headers=DAVE)
    assert post_id not in [p["id"] for p in client.get("/posts").json()]
    assert client.post(f"/admin/posts/{post_id}", json={"status": "approved"}, headers=ADMIN).json()["status"] == "approved"
    assert post_id in [p["id"] for p in client.get("/posts").json()]


def test_abusive_post_waits_for_a_moderator_and_pii_is_scrubbed(client):
    held = post(client, ALICE, body="You are all a bunch of sh1t heads").json()
    assert held["status"] == "pending"
    assert held["id"] not in [p["id"] for p in client.get("/posts").json()]
    scrubbed = post(client, BOB, body="Email me at pat@example.org for a ride").json()
    assert "example.org" not in scrubbed["body"] and scrubbed["pii_removed"] == ["email"]
    assert post(client, BOB, body="ok", ).status_code == 422
    assert client.post("/posts", json={"body": "No consent given here", "area": "citywide", "consent": False, "age_confirmed": True}, headers=BOB).status_code == 422


def test_moderation_helpers():
    from moderation import needs_review, scrub_pii

    assert scrub_pii("Dial 211 or 988 any time")[1] == []
    assert scrub_pii("SSN 123-45-6789")[0] == "SSN [id number removed]"
    assert needs_review("I will hurt you") and needs_review("fuuuuck this") and not needs_review("The class on Tuesday was great")


# ---- Subscriptions, export, deletion ----------------------------------------------------------

def test_subscription_survives_a_restart_and_can_be_removed(client):
    assert client.get("/subscriptions", headers=ALICE).json()["subscribed"] is False
    saved = client.put("/subscriptions", json={"categories": ["budget", "civic", "budget"], "areas": ["94536"], "notifications": True}, headers=ALICE).json()
    assert saved["categories"] == ["budget", "civic"]
    restart()
    again = client.get("/subscriptions", headers=ALICE).json()
    assert again["subscribed"] is True and again["areas"] == ["94536"] and again["notifications"] is True
    assert client.get("/subscriptions", headers=BOB).json()["subscribed"] is False
    assert client.delete("/subscriptions", headers=ALICE).json() == {"subscribed": False, "removed": 1}
    assert client.put("/subscriptions", json={"categories": ["weather"]}, headers=ALICE).status_code == 422


def test_delete_my_data_removes_everything_and_leaves_others_alone(client):
    client.post("/reports", json=report_body(), headers=ALICE)
    alice_post = post(client, ALICE).json()["id"]
    bob_post = post(client, BOB, body="Senior InfoLine called me back in a day.").json()["id"]
    client.post(f"/posts/{bob_post}/vote", headers=ALICE)
    client.post(f"/posts/{alice_post}/vote", headers=BOB)
    client.put("/subscriptions", json={"categories": ["budget"]}, headers=ALICE)

    export = client.get("/me/export", headers=ALICE).json()["data"]
    assert len(export["reports"]) == 1 and len(export["posts"]) == 1 and len(export["consent_records"]) == 2
    assert "owner_hash" not in export["reports"][0]

    receipt = client.delete("/me", headers=ALICE).json()
    assert receipt["receipt_id"] and receipt["deleted"]["reports"] == 1 and receipt["deleted"]["posts"] == 1

    after = client.get("/me/export", headers=ALICE).json()["data"]
    assert all(rows == [] for rows in after.values())
    posts = {p["id"]: p for p in client.get("/posts").json()}
    assert alice_post not in posts and posts[bob_post]["upvotes"] == 0  # Alice's vote went with her data
    assert len(client.get("/me/export", headers=BOB).json()["data"]["posts"]) == 1
    assert client.delete("/me").status_code == 400


def test_public_deletion_request_and_admin_follow_up(client):
    body = {"contact_email": "Parent@Example.com", "details": "Please remove the report my child sent on Oct 3.", "relationship": "parent_or_guardian", "consent": True}
    receipt = client.post("/deletion-requests", json=body).json()
    assert receipt["respond_within_days"] == 30 and receipt["receipt_id"]
    assert client.post("/deletion-requests", json={**body, "consent": False}).status_code == 422
    assert client.get("/admin/deletion-requests").status_code == 403
    listed = client.get("/admin/deletion-requests", headers=ADMIN).json()
    assert listed[0]["contact_email"] == "parent@example.com"
    closed = client.post(f"/admin/deletion-requests/{receipt['receipt_id']}", json={"status": "completed"}, headers=ADMIN).json()
    assert closed["contact_email"] is None and closed["completed_at"]


def test_email_alerts_collect_nothing_while_there_is_no_sender_and_unsubscribe_still_works(client, env):
    body = {"email": "Resident@Example.com", "categories": ["budget"], "areas": [], **CONSENT}
    env.setenv("SMTP_HOST", "smtp.example.test")
    env.setenv("EMAIL_FROM", "alerts@example.test")
    env.setenv("PUBLIC_API_URL", "https://api.example.test")
    restart()
    assert client.get("/config").json()["email_enabled"] is False
    assert client.post("/email/subscribe", json=body, headers=ALICE).json()["detail"] == "email_not_configured"

    import store
    from routers.account import unsubscribe_url

    assert store.get_store().list("email_subscriptions") == []
    # An address stored by an earlier version can still be removed with its link.
    row = store.get_store().insert("email_subscriptions", {"email": "resident@example.com", "categories": [], "areas": [], "owner_hash": "x"})
    link = unsubscribe_url(row["id"])
    assert link.startswith("https://api.example.test/email/unsubscribe?token=")
    token = link.split("token=")[1]

    assert client.get("/email/unsubscribe", params={"token": token + "x"}).status_code == 400
    assert client.post("/email/unsubscribe", params={"token": "garbage"}).status_code == 400
    page = client.get("/email/unsubscribe", params={"token": token})
    assert page.status_code == 200 and "Confirm unsubscribe" in page.text
    assert store.get_store().list("email_subscriptions")
    assert client.post("/email/unsubscribe", params={"token": token}).json() == {"unsubscribed": True}
    assert store.get_store().list("email_subscriptions") == []
    assert client.post("/email/unsubscribe", params={"token": token}).json() == {"unsubscribed": True}  # repeat is harmless


def test_feedback_is_stored_without_identifiers(client):
    assert client.post("/feedback", json={"kind": "data_error", "message": "The library phone number looks wrong."}).status_code == 201
    rows = client.get("/admin/feedback", headers=ADMIN).json()
    assert rows[0]["kind"] == "data_error" and "owner_hash" not in rows[0]


# ---- Admin and the impact dashboard -----------------------------------------------------------

def test_admin_routes_need_the_token(client):
    from security import limiter

    for path in ("/admin/me", "/admin/reports", "/admin/posts", "/impact/export.csv"):
        limiter.reset()
        assert client.get(path).status_code == 403, path
        assert client.get(path, headers={"X-Admin-Token": "wrong"}).status_code == 403, path
        assert client.get(path, headers=ADMIN).status_code == 200, path


def test_without_an_admin_token_the_server_says_admin_is_not_set_up(client, env):
    assert client.get("/config").json()["admin_enabled"] is True
    env.setenv("ADMIN_TOKEN", "")
    restart()
    assert client.get("/config").json()["admin_enabled"] is False
    assert client.get("/admin/me", headers=ADMIN).status_code == 403
    assert client.get("/impact/summary").status_code == 200


def test_impact_dashboard_counts_only_verified_reports(client):
    ids = []
    for level, area in (("high", "94538"), ("high", "94536"), ("low", "94538")):
        ids.append(client.post("/reports", json=report_body(impact_level=level, area=area), headers=ALICE).json()["id"])
    formula = client.post("/reports", json=report_body(description="=HYPERLINK(1) pothole near the school"), headers=BOB).json()["id"]
    client.post(f"/admin/reports/{ids[0]}", json={"status": "verified"}, headers=ADMIN)
    client.post(f"/admin/reports/{ids[2]}", json={"status": "verified"}, headers=ADMIN)
    client.post(f"/admin/reports/{ids[1]}", json={"status": "rejected"}, headers=ADMIN)
    client.post(f"/admin/reports/{formula}", json={"status": "verified"}, headers=ADMIN)

    summary = client.get("/impact/summary").json()
    assert "description" not in str(summary) and "potholes" not in str(summary)
    assert (summary["verified_total"], summary["pending_total"], summary["rejected_total"]) == (3, 0, 1)
    assert summary["by_impact"] == [{"key": "high", "total": 1}, {"key": "medium", "total": 1}, {"key": "low", "total": 1}]
    assert summary["by_service"][0] == {"key": "Street pavement maintenance", "total": 3, "high": 1, "medium": 1, "low": 1}
    assert {item["key"]: item["total"] for item in summary["by_area"]} == {"94538": 3}

    export = client.get("/impact/export.csv", headers=ADMIN)
    assert export.headers["content-type"].startswith("text/csv")
    lines = export.text.strip().splitlines()
    assert lines[0] == "report_id,created_at,service,area,impact_level,description" and len(lines) == 4
    assert "'=HYPERLINK" in export.text and "owner_hash" not in export.text


def test_admin_service_status_update_survives_a_restart(client):
    updated = client.post("/admin/services/svc-age-well-lake", json={"status": "closed", "summary": "Closed for repairs this week (test entry)."}, headers=ADMIN).json()
    assert updated["status"] == "closed"
    restart()
    assert client.get("/services/svc-age-well-lake").json()["status"] == "closed"
    assert client.get("/stats").json()["services_closed"] == 1
    assert client.post("/admin/services/svc-nope", json={"status": "open"}, headers=ADMIN).status_code == 404


def test_delete_and_export_cover_what_was_posted_before_signing_in(client, monkeypatch):
    import security

    before = client.post("/posts", json={"body": "Posted before I had an account.", "area": "94538", **CONSENT}, headers=ALICE).json()
    # The same device, now signed in: requests carry both the account and the install token.
    monkeypatch.setattr(security, "signed_in_user", lambda request: {"id": "user-1", "role": None})
    client.post("/posts", json={"body": "Posted after signing in to my account.", "area": "94538", **CONSENT}, headers=ALICE)
    assert len(client.get("/me/export", headers=ALICE).json()["data"]["posts"]) == 2
    assert client.delete("/me", headers=ALICE).json()["deleted"]["posts"] == 2
    monkeypatch.undo()
    assert before["id"] not in [post["id"] for post in client.get("/posts").json()]
