"""Read-only routes anyone can call: services, resources, alerts, budget, council, stats."""
from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from grounding import with_distance
from security import owner_from
from settings import POLICY_VERSION, get_settings
from store import Row, get_store, now_iso, reference

router = APIRouter(tags=["public"])
# Columns that must never leave the server.
PRIVATE_FIELDS = ("owner_hash", "photo_path", "policy_version")


def public_row(row: Row) -> Row:
    return {key: value for key, value in row.items() if key not in PRIVATE_FIELDS}


def _matches_text(row: Row, query: str, fields: tuple[str, ...]) -> bool:
    needle = query.strip().lower()
    return not needle or any(needle in str(row.get(field) or "").lower() for field in fields)


@router.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "mode": get_store().mode, "ai": get_settings().ai_enabled}


@router.get("/config")
def config() -> dict[str, Any]:
    """What this deployment supports, so the app only shows controls that work."""
    settings = get_settings()
    return {
        "mode": get_store().mode,
        "ai_enabled": settings.ai_enabled,
        "email_enabled": settings.email_enabled,
        "auth_enabled": settings.use_supabase,
        # False when nobody could ever pass require_admin: no ADMIN_TOKEN and no accounts.
        "admin_enabled": bool(settings.admin_token) or settings.use_supabase,
        "policy_version": POLICY_VERSION,
        "data_retrieved": reference("budget")["retrieved"],
    }


# ---- Community Impact dashboard: totals of verified reports, no report text -------------------

IMPACT_LEVELS = ("high", "medium", "low")


def verified_reports() -> list[Row]:
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
    rows = verified_reports()
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


@router.get("/services")
def list_services(
    category: str | None = Query(default=None, max_length=40),
    area: str | None = Query(default=None, max_length=20),
    status: str | None = Query(default=None, pattern="^(open|reduced|closed)$"),
    q: str = Query(default="", max_length=80),
) -> list[Row]:
    rows = get_store().list("services", order="name")
    return [
        row for row in rows
        if (not category or row.get("category") == category)
        and (not area or row.get("area") == area)
        and (not status or row.get("status") == status)
        and _matches_text(row, q, ("name", "summary", "detail", "address", "category", "location_note"))
    ]


@router.get("/services/{service_id}")
def get_service(service_id: str) -> Row:
    row = get_store().get("services", service_id)
    if row is None:
        raise HTTPException(status_code=404, detail="service_not_found")
    return row


@router.get("/resources")
def list_resources(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    category: str | None = Query(default=None, max_length=40),
    q: str = Query(default="", max_length=80),
) -> list[Row]:
    """Resources, nearest first when a position is given, otherwise by name."""
    if (lat is None) != (lng is None):
        raise HTTPException(status_code=422, detail="Provide both lat and lng, or neither")
    rows = [
        row for row in get_store().list("resources", order="name")
        if (not category or row.get("category") == category)
        and _matches_text(row, q, ("name", "description", "address", "category", "hours"))
    ]
    return with_distance(rows, lat, lng)


@router.get("/alerts")
def list_alerts(
    category: str | None = Query(default=None, max_length=40),
    area: str | None = Query(default=None, max_length=20),
) -> list[Row]:
    rows = get_store().list("alerts", order="published_at", desc=True)
    return [
        row for row in rows
        if (not category or row.get("category") == category)
        and (not area or row.get("area") in (area, "citywide"))
    ]


@router.get("/stats")
def stats() -> dict[str, int]:
    """Counts straight from the database. The home screen shows these, never a fixed number."""
    store = get_store()
    services = store.list("services")
    return {
        "reports_total": store.count("reports", {"status": "verified"}),
        "reports_verified": store.count("reports", {"status": "verified"}),
        "posts": store.count("posts", {"status": "approved", "is_sample": False}),
        "services_tracked": len(services),
        "services_reduced": sum(1 for s in services if s.get("status") == "reduced"),
        "services_closed": sum(1 for s in services if s.get("status") == "closed"),
        "resources": store.count("resources"),
    }


@router.get("/status")
def status_summary() -> dict[str, Any]:
    """Service Status Dashboard: counts by status, category and area, plus recent changes."""
    services = get_store().list("services")
    by_category: dict[str, Counter] = {}
    by_area: dict[str, Counter] = {}
    for service in services:
        by_category.setdefault(service["category"], Counter())[service["status"]] += 1
        by_area.setdefault(service["area"], Counter())[service["status"]] += 1
    recent = sorted(services, key=lambda s: s.get("updated_at") or "", reverse=True)[:8]
    return {
        "total": len(services),
        "by_status": dict(Counter(s["status"] for s in services)),
        "by_category": {key: dict(value) for key, value in sorted(by_category.items())},
        "by_area": {key: dict(value) for key, value in sorted(by_area.items())},
        "recent": [
            {key: s.get(key) for key in ("id", "name", "status", "category", "area", "summary", "updated_at", "source_title", "source_url")}
            for s in recent
        ],
        "data_retrieved": max((s.get("retrieved") or "" for s in services), default=""),
    }


@router.get("/budget")
def budget() -> Any:
    return reference("budget")


@router.get("/council")
def council() -> dict[str, Any]:
    return {**reference("council"), "votes": reference("votes")}


@router.get("/zips")
def zips() -> Any:
    return reference("zips")


@router.get("/zips/{zip_code}")
def lookup_zip(zip_code: str) -> dict[str, Any]:
    table = reference("zips")
    match = next((z for z in table["zips"] if z["zip"] == zip_code), None)
    if match is None:
        raise HTTPException(status_code=404, detail="zip_not_in_fremont")
    return match


@router.get("/posts")
def list_posts(request: Request, sort: str = Query(default="top", pattern="^(top|new)$")) -> list[Row]:
    """Approved community posts. `mine` and `voted` tell the app what this device may do."""
    store = get_store()
    owner = owner_from(request)
    voted = {vote["post_id"] for vote in store.list("post_votes", {"owner_hash": owner})} if owner else set()
    posts = []
    for post in store.list("posts", {"status": "approved"}):
        posts.append({**public_row(post), "upvotes_approximate": True, "mine": bool(owner) and post.get("owner_hash") == owner, "voted": post["id"] in voted})
    if sort == "top":
        posts.sort(key=lambda p: (p.get("upvotes") or 0, p.get("created_at") or ""), reverse=True)
    else:
        posts.sort(key=lambda p: p.get("created_at") or "", reverse=True)
    return posts
