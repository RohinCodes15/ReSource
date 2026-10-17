"""Routes about a person's own data: alert preferences, email alerts, export and deletion."""
from __future__ import annotations

import uuid
from html import escape
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from httpx import RequestError
from supabase_auth.errors import AuthError

from chat_sessions import sessions
from moderation import clean_text
from routers.contribute import reject_bots
from routers.public import public_row
from schemas import DeletionRequestIn, EmailSubscribeIn, SubscriptionIn
from security import rate_limit, require_owner, require_owners, sign, signed_in_user, unsign
from settings import POLICY_VERSION, get_settings
from store import Row, get_store, now_iso

router = APIRouter(tags=["account"])
# Deletion is immediate for data tied to an install token; mailed-in requests are handled by hand.
DELETION_WINDOW_DAYS = 30


def _subscription(owner: str) -> Row | None:
    rows = get_store().list("subscriptions", {"owner_hash": owner})
    return rows[0] if rows else None


@router.get("/subscriptions")
def get_subscription(request: Request) -> dict[str, Any]:
    row = _subscription(require_owner(request))
    if row is None:
        return {"subscribed": False, "categories": [], "areas": [], "notifications": False}
    return {"subscribed": True, "categories": row["categories"], "areas": row["areas"],
            "notifications": row["notifications"], "updated_at": row.get("updated_at")}


@router.put("/subscriptions", dependencies=[Depends(rate_limit("subscribe", 30, 3600))])
def save_subscription(preferences: SubscriptionIn, request: Request) -> dict[str, Any]:
    owner = require_owner(request)
    store = get_store()
    changes = {**preferences.model_dump(), "updated_at": now_iso()}
    existing = _subscription(owner)
    if existing:
        store.update("subscriptions", existing["id"], changes)
    else:
        store.insert("subscriptions", {"owner_hash": owner, **changes})
    return {"subscribed": True, **changes}


@router.delete("/subscriptions")
def delete_subscription(request: Request) -> dict[str, Any]:
    removed = get_store().delete("subscriptions", {"owner_hash": require_owner(request)})
    return {"subscribed": False, "removed": removed}


# ---- Email alerts (only when SMTP is configured; see deployment/ENV.md) ------------------------

def unsubscribe_url(email_subscription_id: str) -> str:
    return f"{get_settings().public_api_url}/email/unsubscribe?token={sign(email_subscription_id)}"


@router.post("/email/subscribe", status_code=201, dependencies=[Depends(rate_limit("email", 3, 3600))])
def email_subscribe(body: EmailSubscribeIn, request: Request) -> dict[str, Any]:
    # No sender or address-confirmation flow exists. Do not collect addresses or retain a
    # dormant writer that could reassign ownership when someone flips a configuration flag.
    raise HTTPException(status_code=503, detail="email_not_configured")


def _unsubscribe(token: str) -> bool:
    subscription_id = unsign(token)
    return bool(subscription_id) and get_store().delete("email_subscriptions", {"id": subscription_id}) >= 0


UNSUBSCRIBED_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribed | ReSource</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;color:#0F172A">
<h1 style="color:#1B3A6B">{title}</h1><p>{body}</p></body></html>"""


@router.get("/email/unsubscribe", response_class=HTMLResponse)
def email_unsubscribe_link(token: str = Query(max_length=400)) -> HTMLResponse:
    """GET only confirms; mail scanners must never change subscription state."""
    subscription_id = unsign(token)
    if not subscription_id:
        page = UNSUBSCRIBED_PAGE.format(title="This link is not valid", body="It may have been copied incompletely.")
        return HTMLResponse(page, status_code=400)
    if get_store().get("email_subscriptions", subscription_id) is None:
        return HTMLResponse(UNSUBSCRIBED_PAGE.format(title="Already unsubscribed", body="This subscription no longer exists."))
    form = f'<form method="post" action="/email/unsubscribe?token={escape(token, quote=True)}"><button type="submit">Unsubscribe</button></form>'
    return HTMLResponse(UNSUBSCRIBED_PAGE.format(title="Confirm unsubscribe", body="Remove this address from ReSource alerts?" + form))


@router.post("/email/unsubscribe")
def email_unsubscribe_one_click(token: str = Query(max_length=400)) -> dict[str, Any]:
    """RFC 8058 one-click target named in the List-Unsubscribe-Post header."""
    if not _unsubscribe(token):
        raise HTTPException(status_code=400, detail="invalid_token")
    return {"unsubscribed": True}


# ---- Access and deletion ----------------------------------------------------------------------

OWNED_TABLES = ("reports", "posts", "post_votes", "post_flags", "subscriptions", "email_subscriptions", "consent_records")


@router.delete("/me/account", dependencies=[Depends(rate_limit("delete-account", 3, 3600))])
def delete_my_account(request: Request) -> dict[str, Any]:
    """Delete only the verified Auth account/email; install-owned contributions stay intact."""
    user = signed_in_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="sign_in_required", headers={"WWW-Authenticate": "Bearer"})
    store = get_store()
    if store.mode != "supabase":
        raise HTTPException(status_code=503, detail="account_deletion_unavailable")
    try:
        # Hard deletion removes Auth identity/email. Account consent cascades via its FK.
        # Never call delete_my_data or delete any install-owned rows here.
        store.client.auth.admin.delete_user(user["id"], should_soft_delete=False)
    except (AuthError, RequestError) as exc:
        status = getattr(exc, "status", None)
        if status == 404:
            raise HTTPException(status_code=404, detail="account_not_found") from exc
        if status in (401, 403):
            raise HTTPException(status_code=503, detail="account_deletion_unavailable") from exc
        raise HTTPException(status_code=502, detail="account_deletion_failed") from exc
    return {"account_deleted": True, "reports_deleted": False, "completed_at": now_iso()}


@router.get("/me/account/export")
def export_my_account(request: Request) -> dict[str, Any]:
    """Account-only export: no install-owned reports or other resident contributions."""
    user = signed_in_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="sign_in_required", headers={"WWW-Authenticate": "Bearer"})
    store = get_store()
    if store.mode != "supabase":
        raise HTTPException(status_code=503, detail="account_export_unavailable")
    consents = store.list("account_consents", {"user_id": user["id"]}, order="accepted_at", desc=True)
    return {"email": user.get("email"), "consents": [
        {"policy_version": row["policy_version"], "accepted_at": row["accepted_at"]}
        for row in consents
    ]}


@router.get("/me/export")
def export_my_data(request: Request) -> dict[str, Any]:
    """Everything stored about this device or account, as JSON the app saves to a file."""
    owners = require_owners(request)
    store = get_store()
    data: dict[str, Any] = {}
    for table in OWNED_TABLES:
        rows = [row for owner in owners for row in store.list(table, {"owner_hash": owner})]
        data[table] = [{**public_row(row), **({"email": row["email"]} if "email" in row else {})} for row in rows]
    return {"exported_at": now_iso(), "policy_version": POLICY_VERSION, "data": data,
            "note": "ReSource does not store your name, IP address or precise location."}


@router.delete("/me", dependencies=[Depends(rate_limit("delete-me", 5, 3600))])
def delete_my_data(request: Request) -> dict[str, Any]:
    """Deletes this device's or account's reports, posts, votes, subscriptions and consent records now."""
    owners = require_owners(request)
    store = get_store()
    voted_posts: list[str] = []
    for owner in owners:
        sessions.forget(owner)
        for report in store.list("reports", {"owner_hash": owner}):
            if report.get("photo_path"):
                store.delete_file(report["photo_path"])
        for post in store.list("posts", {"owner_hash": owner}):
            store.delete("post_votes", {"post_id": post["id"]})
            store.delete("post_flags", {"post_id": post["id"]})
        voted_posts += [vote["post_id"] for vote in store.list("post_votes", {"owner_hash": owner})]
    deleted = {table: sum(store.delete(table, {"owner_hash": owner}) for owner in owners) for table in OWNED_TABLES}
    for post_id in voted_posts:  # keep the public counts honest after removing this person's votes
        if store.get("posts", post_id):
            store.update("posts", post_id, {"upvotes": store.count("post_votes", {"post_id": post_id})})
    return {"receipt_id": uuid.uuid4().hex[:12], "completed_at": now_iso(), "deleted": deleted}


@router.post("/deletion-requests", status_code=201, dependencies=[Depends(rate_limit("deletion-request", 3, 3600))])
def request_deletion(body: DeletionRequestIn) -> dict[str, Any]:
    """For people who cannot use "Delete my data" in the app, including a parent or guardian."""
    reject_bots(body.website)
    row = get_store().insert("deletion_requests", {
        "contact_email": body.contact_email.lower(),
        "details": clean_text(body.details),
        "relationship": body.relationship,
        "status": "open",
    })
    return {"receipt_id": row["id"], "received_at": row.get("created_at") or now_iso(), "respond_within_days": DELETION_WINDOW_DAYS}
