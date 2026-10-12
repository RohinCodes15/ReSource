"""Admin-only routes: moderation, service status updates and the Community Impact dashboard.

Every route here requires `require_admin`: the ADMIN_TOKEN header, or a signed-in Supabase user
whose app_metadata.role is "admin".
"""
from __future__ import annotations

import csv
import io
from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from routers.public import public_row
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


# ---- Community Impact dashboard: verified reports only ----------------------------------------

IMPACT_LEVELS = ("high", "medium", "low")


def _verified() -> list[Row]:
    return get_store().list("reports", {"status": "verified"}, order="created_at", desc=True)


def _breakdown(rows: list[Row], key: str) -> list[dict[str, Any]]:
    groups: dict[str, Counter] = {}
    for row in rows:
        groups.setdefault(row.get(key) or "unknown", Counter())[row["impact_level"]] += 1
    out = [{"key": name, "total": sum(counts.values()), **{level: counts.get(level, 0) for level in IMPACT_LEVELS}}
           for name, counts in groups.items()]
    return sorted(out, key=lambda item: (-item["total"], item["key"]))


@router.get("/impact/summary")
def impact_summary() -> dict[str, Any]:
    rows = _verified()
    store = get_store()
    levels = Counter(row["impact_level"] for row in rows)
    return {
        "verified_total": len(rows),
        "pending_total": store.count("reports", {"status": "pending"}),
        "rejected_total": store.count("reports", {"status": "rejected"}),
        "by_impact": [{"key": level, "total": levels.get(level, 0)} for level in IMPACT_LEVELS],
        "by_service": _breakdown(rows, "service_name"),
        "by_area": _breakdown(rows, "area"),
        "generated_at": now_iso(),
    }


@router.get("/impact/export.csv")
def impact_export() -> Response:
    """Verified reports as CSV. Contains no identifiers: owner hashes and photos are left out."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["report_id", "created_at", "service", "area", "impact_level", "description"])
    for row in _verified():
        description = str(row.get("description") or "")
        # A leading =, +, - or @ would be run as a formula by spreadsheet software.
        if description[:1] in ("=", "+", "-", "@"):
            description = "'" + description
        writer.writerow([row["id"], row.get("created_at"), row.get("service_name"), row.get("area"), row.get("impact_level"), description])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="resource-verified-reports.csv"'},
    )
