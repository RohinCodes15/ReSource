"""Admin-only routes: moderation, service status updates and the Community Impact CSV export.

Every route here requires `require_admin`: the ADMIN_TOKEN header, or a signed-in Supabase user
whose app_metadata.role is "admin".
"""
from __future__ import annotations

import csv
import io
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from community_guard import guard
from routers.public import public_row, verified_reports
from schemas import (
    DeletionRequestStatusIn,
    ModeratePostIn,
    ModerateReportIn,
    ServiceStatusIn,
)
from security import require_admin
from store import Row, get_store, now_iso

router = APIRouter(tags=["admin"], dependencies=[Depends(require_admin)])


def _report_view(row: Row) -> Row:
    return {**public_row(row), "has_photo": bool(row.get("photo_path"))}


@router.get("/admin/me")
def whoami(method: str = Depends(require_admin)) -> dict[str, str]:
    return {"admin": "true", "method": method}


@router.get("/admin/reports")
def reports(status: str = Query(default="pending", pattern="^(pending|verified|rejected|all)$")) -> list[Row]:
    filters = None if status == "all" else {"status": status}
    return [_report_view(r) for r in get_store().list("reports", filters, order="created_at", desc=True, limit=200)]


@router.get("/admin/reports/{report_id}/photo")
def report_photo(report_id: str) -> Response:
    """The photo attached to a report, so a moderator can look at it before verifying."""
    report = get_store().get("reports", report_id)
    data = get_store().read_file(report["photo_path"]) if report and report.get("photo_path") else None
    if data is None:
        raise HTTPException(status_code=404, detail="photo_not_found")
    return Response(content=data, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.post("/admin/reports/{report_id}")
def moderate_report(report_id: str, body: ModerateReportIn) -> Row:
    row = get_store().update("reports", report_id, {"status": body.status, "reviewed_at": now_iso()})
    if row is None:
        raise HTTPException(status_code=404, detail="report_not_found")
    return _report_view(row)


@router.get("/admin/posts")
def posts(status: str = Query(default="pending", pattern="^(pending|approved|rejected|all)$")) -> list[Row]:
    store = get_store()
    filters = None if status == "all" else {"status": status}
    rows = store.list("posts", filters, order="created_at", desc=True, limit=200)
    return [{**public_row(row), "flags": store.count("post_flags", {"post_id": row["id"]})} for row in rows]


@router.post("/admin/posts/{post_id}")
def moderate_post(post_id: str, body: ModeratePostIn) -> Row:
    store = get_store()
    row = store.update("posts", post_id, {"status": body.status})
    if row is None:
        raise HTTPException(status_code=404, detail="post_not_found")
    if body.status == "approved":  # an approved post starts again with a clean record
        store.delete("post_flags", {"post_id": post_id})
        guard.clear_flags(post_id)
    return public_row(row)


@router.post("/admin/services/{service_id}")
def update_service(service_id: str, body: ServiceStatusIn) -> Row:
    changes: dict[str, Any] = {"status": body.status, "updated_at": now_iso()[:10]}
    if body.summary:
        changes["summary"] = body.summary
    row = get_store().update("services", service_id, changes)
    if row is None:
        raise HTTPException(status_code=404, detail="service_not_found")
    return row


@router.get("/admin/deletion-requests")
def deletion_requests() -> list[Row]:
    return get_store().list("deletion_requests", order="created_at", desc=True, limit=200)


@router.post("/admin/deletion-requests/{request_id}")
def close_deletion_request(request_id: str, body: DeletionRequestStatusIn) -> Row:
    changes: dict[str, Any] = {"status": body.status}
    if body.status == "completed":
        # Once handled, the requester's email address is no longer needed.
        changes.update({"contact_email": None, "completed_at": now_iso()})
    row = get_store().update("deletion_requests", request_id, changes)
    if row is None:
        raise HTTPException(status_code=404, detail="request_not_found")
    return row


@router.get("/admin/feedback")
def feedback() -> list[Row]:
    return get_store().list("feedback", order="created_at", desc=True, limit=200)


# ---- Community Impact export (the totals themselves are public: routers/public.py) -----------

def safe_csv_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    # Protect every column, including legacy rows and whitespace-prefixed spreadsheet formulas.
    return "'" + text if re.match(r"^\s*[=+@\-\t\r\n]", text) else text


@router.get("/impact/export.csv")
def impact_export() -> Response:
    """Verified reports as CSV. Contains no identifiers: owner hashes and photos are left out."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["report_id", "created_at", "service", "area", "impact_level", "description"])
    for row in verified_reports():
        writer.writerow([safe_csv_cell(row.get(key)) for key in
                         ("id", "created_at", "service_name", "area", "impact_level", "description")])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="resource-verified-reports.csv"'},
    )
