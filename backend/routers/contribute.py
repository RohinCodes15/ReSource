"""Routes where residents write something: impact reports, community posts, votes, feedback."""
from __future__ import annotations

import io
import uuid
import warnings
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from community_guard import guard
from moderation import clean_text, needs_review, scrub_pii
from routers.public import public_row
from schemas import FeedbackIn, PostIn, ReportIn
from security import client_fingerprint, rate_limit, require_owner
from settings import POLICY_VERSION
from store import Row, StoreError, get_store, now_iso

router = APIRouter(tags=["contribute"])

MAX_PHOTO_BYTES = 5 * 1024 * 1024
# A small file can still decode to a huge bitmap (one flat color compresses to almost nothing).
MAX_PHOTO_PIXELS = 25_000_000
PHOTO_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
FLAGS_BEFORE_REVIEW = 3


def reject_bots(honeypot: str) -> None:
    """The `website` field is hidden from people. Anything in it means a script filled the form."""
    if honeypot.strip():
        raise HTTPException(status_code=400, detail="spam_detected")


def record_consent(owner: str, kind: str) -> None:
    """What was agreed to, which policy version, and when. No other personal data."""
    get_store().insert("consent_records", {"owner_hash": owner, "kind": kind, "policy_version": POLICY_VERSION})


@router.post("/reports", status_code=201, dependencies=[Depends(rate_limit("report", 5, 3600))])
def create_report(report: ReportIn, request: Request) -> Row:
    reject_bots(report.website)
    owner = require_owner(request)
    store = get_store()
    service_name = clean_text(report.service_name)
    if report.service_id:
        service = store.get("services", report.service_id)
        if service is None:
            raise HTTPException(status_code=422, detail="unknown_service")
        service_name = service["name"]
    description, removed = scrub_pii(clean_text(report.description))
    row = store.insert("reports", {
        "service_id": report.service_id,
        "service_name": service_name,
        "area": report.area,
        "description": description,
        "impact_level": report.impact_level,
        "status": "pending",  # every report waits for a moderator before it counts anywhere
        "photo_path": None,
        "owner_hash": owner,
        "policy_version": POLICY_VERSION,
    })
    record_consent(owner, "report")
    return {**public_row(row), "pii_removed": removed}


@router.get("/reports/mine")
def my_reports(request: Request) -> list[Row]:
    owner = require_owner(request)
    rows = get_store().list("reports", {"owner_hash": owner}, order="created_at", desc=True)
    return [{**public_row(row), "has_photo": bool(row.get("photo_path"))} for row in rows]


@router.post("/reports/{report_id}/photo", dependencies=[Depends(rate_limit("photo", 10, 3600))])
def attach_photo(report_id: str, request: Request, photo: UploadFile = File(...)) -> dict[str, Any]:
    """Optional photo for a report the caller just filed. JPEG, PNG or WebP, at most 5 MB.

    The image is decoded and re-encoded as JPEG, which removes embedded metadata such as the
    GPS position a phone camera records, and proves the upload really is an image.
    """
    owner = require_owner(request)
    store = get_store()
    report = store.get("reports", report_id)
    if report is None or report.get("owner_hash") != owner:
        raise HTTPException(status_code=404, detail="report_not_found")
    # A plain `def`: FastAPI runs it in a worker thread, so decoding does not stall other requests.
    data = photo.file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="photo_too_large")
    try:
        from PIL import Image, ImageOps

        Image.MAX_IMAGE_PIXELS = MAX_PHOTO_PIXELS
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(io.BytesIO(data))
        if image.format not in PHOTO_FORMATS:
            raise ValueError(image.format)
        # The size comes from the file header, before any pixels are decoded.
        if image.width * image.height > MAX_PHOTO_PIXELS:
            raise HTTPException(status_code=413, detail="photo_too_large")
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((1600, 1600))
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=82)
    except (Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=413, detail="photo_too_large") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=415, detail="unsupported_photo_type") from exc
    if report.get("photo_path"):
        store.delete_file(report["photo_path"])
    path = store.save_file(f"{report_id}-{uuid.uuid4().hex[:8]}.jpg", buffer.getvalue(), "image/jpeg")
    store.update("reports", report_id, {"photo_path": path})
    return {"id": report_id, "has_photo": True}


@router.delete("/reports/{report_id}/photo")
def remove_photo(report_id: str, request: Request) -> dict[str, Any]:
    owner = require_owner(request)
    store = get_store()
    report = store.get("reports", report_id)
    if report is None or report.get("owner_hash") != owner:
        raise HTTPException(status_code=404, detail="report_not_found")
    if report.get("photo_path"):
        store.delete_file(report["photo_path"])
        store.update("reports", report_id, {"photo_path": None})
    return {"id": report_id, "has_photo": False}


@router.post("/posts", status_code=201, dependencies=[Depends(rate_limit("post", 5, 3600))])
def create_post(post: PostIn, request: Request) -> Row:
    reject_bots(post.website)
    owner = require_owner(request)
    body, removed = scrub_pii(clean_text(post.body))
    if len(body) < 3:
        raise HTTPException(status_code=422, detail="post_too_short")
    row = get_store().insert("posts", {
        "body": body,
        "area": post.area,
        "upvotes": 0,
        # Clean posts appear at once; anything the filter catches waits for a moderator.
        "status": "pending" if needs_review(body) else "approved",
        "is_sample": False,
        "owner_hash": owner,
        "policy_version": POLICY_VERSION,
    })
    record_consent(owner, "post")
    return {**public_row(row), "mine": True, "voted": False, "pii_removed": removed}


@router.post("/posts/{post_id}/vote", dependencies=[Depends(rate_limit("vote", 60, 3600))])
def toggle_vote(post_id: str, request: Request) -> dict[str, Any]:
    """One upvote per device or account. Calling it again removes the vote."""
    owner = require_owner(request)
    store = get_store()
    post = store.get("posts", post_id)
    if post is None or post.get("status") != "approved":
        raise HTTPException(status_code=404, detail="post_not_found")
    guard.record("vote", post_id, client_fingerprint(request), owner)
    already = store.count("post_votes", {"post_id": post_id, "owner_hash": owner}) > 0
    if already:
        store.delete("post_votes", {"post_id": post_id, "owner_hash": owner})
    else:
        try:
            store.insert("post_votes", {"post_id": post_id, "owner_hash": owner})
        except StoreError:
            # Two taps arrived together and the other one stored the vote first (unique key).
            if store.count("post_votes", {"post_id": post_id, "owner_hash": owner}) == 0:
                raise
    upvotes = store.count("post_votes", {"post_id": post_id})
    store.update("posts", post_id, {"upvotes": upvotes})
    return {"id": post_id, "upvotes": upvotes, "voted": not already}


@router.post("/posts/{post_id}/flag", dependencies=[Depends(rate_limit("flag", 10, 3600))])
def flag_post(post_id: str, request: Request) -> dict[str, Any]:
    """Hold a post only after flags from three distinct owners AND network buckets."""
    owner = require_owner(request)
    store = get_store()
    post = store.get("posts", post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="post_not_found")
    if store.count("post_flags", {"post_id": post_id, "owner_hash": owner}) == 0:
        try:
            store.insert("post_flags", {"post_id": post_id, "owner_hash": owner})
        except StoreError:
            # The same flag arrived twice at once and the other request stored it (unique key).
            if store.count("post_flags", {"post_id": post_id, "owner_hash": owner}) == 0:
                raise
    flags = guard.record("flag", post_id, client_fingerprint(request), owner)
    if flags >= FLAGS_BEFORE_REVIEW and post.get("status") == "approved":
        store.update("posts", post_id, {"status": "pending"})
    return {"id": post_id, "flagged": True}


@router.delete("/posts/{post_id}")
def delete_post(post_id: str, request: Request) -> dict[str, Any]:
    owner = require_owner(request)
    store = get_store()
    post = store.get("posts", post_id)
    if post is None or post.get("owner_hash") != owner:
        raise HTTPException(status_code=404, detail="post_not_found")
    store.delete("post_votes", {"post_id": post_id})
    store.delete("post_flags", {"post_id": post_id})
    store.delete("posts", {"id": post_id})
    return {"id": post_id, "deleted": True}


@router.post("/feedback", status_code=201, dependencies=[Depends(rate_limit("feedback", 5, 3600))])
def send_feedback(feedback: FeedbackIn) -> dict[str, Any]:
    """Report a problem with the app or its data. Stored without any identifier."""
    reject_bots(feedback.website)
    message, _ = scrub_pii(clean_text(feedback.message))
    row = get_store().insert("feedback", {"kind": feedback.kind, "message": message, "status": "open"})
    return {"id": row["id"], "received_at": row.get("created_at") or now_iso()}
