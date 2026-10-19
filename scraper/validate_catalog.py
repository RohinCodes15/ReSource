"""Validate shared catalog data and optionally fetch every cited source politely."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

SCRAPER_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRAPER_DIR.parent

SERVICE_CATEGORIES = {
    "infrastructure", "parks", "public_safety", "administration",
    "human_services", "seniors", "youth",
}
RESOURCE_CATEGORIES = {
    "Food", "Housing", "Health", "Seniors", "Referral", "Crisis",
    "Legal", "Community", "Library",
}
AREA_CODES = {"citywide", "94536", "94538", "94539", "94555"}
SERVICE_STATUSES = {"open", "reduced", "closed"}
RESOURCE_COORDS = {None, "approximate", "census", "city-directory"}
FREMONT_BOUNDS = {"lat": (37.40, 37.65), "lng": (-122.20, -121.80)}


def load_catalogs() -> tuple[list[dict], list[dict]]:
    services = json.loads((REPO_DIR / "shared/data/services.json").read_text(encoding="utf-8"))
    resources = json.loads((REPO_DIR / "shared/data/resources.json").read_text(encoding="utf-8"))
    return services, resources


def validate_catalogs(services: list[dict], resources: list[dict]) -> list[str]:
    errors: list[str] = []
    if len(services) < 40:
        errors.append(f"services has {len(services)} rows; expected at least 40")
    if len(resources) < 80:
        errors.append(f"resources has {len(resources)} rows; expected at least 80")

    all_ids: set[str] = set()
    for table_name, rows in (("services", services), ("resources", resources)):
        for row in rows:
            row_id = row.get("id")
            if not row_id or row_id in all_ids:
                errors.append(f"{table_name} has a missing or duplicate id: {row_id!r}")
            else:
                all_ids.add(row_id)
            if not row.get("name"):
                errors.append(f"{table_name}/{row_id} has no name")
            if row.get("area") not in AREA_CODES:
                errors.append(f"{table_name}/{row_id} has invalid area {row.get('area')!r}")
            if not row.get("source_url"):
                errors.append(f"{table_name}/{row_id} has no source_url")
            else:
                parsed = urlsplit(row["source_url"])
                if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                    errors.append(f"{table_name}/{row_id} has invalid source_url {row['source_url']!r}")
            try:
                date.fromisoformat(row.get("retrieved", ""))
            except (TypeError, ValueError):
                errors.append(f"{table_name}/{row_id} has invalid retrieved date")
            if row.get("verified") is not True:
                errors.append(f"{table_name}/{row_id} is not source-verified")

            lat, lng = row.get("lat"), row.get("lng")
            if (lat is None) != (lng is None):
                errors.append(f"{table_name}/{row_id} has only one coordinate")
            elif lat is not None and not (
                FREMONT_BOUNDS["lat"][0] <= lat <= FREMONT_BOUNDS["lat"][1]
                and FREMONT_BOUNDS["lng"][0] <= lng <= FREMONT_BOUNDS["lng"][1]
            ):
                errors.append(f"{table_name}/{row_id} coordinates are outside the Fremont map bounds")
            if row.get("coords") not in RESOURCE_COORDS:
                errors.append(f"{table_name}/{row_id} has unsupported coords marker {row.get('coords')!r}")
            if lat is None and row.get("coords") is not None:
                errors.append(f"{table_name}/{row_id} has a coords marker but no coordinates")

    for row in services:
        row_id = row.get("id")
        if row.get("category") not in SERVICE_CATEGORIES:
            errors.append(f"services/{row_id} has invalid category {row.get('category')!r}")
        if row.get("status") not in SERVICE_STATUSES:
            errors.append(f"services/{row_id} has invalid status {row.get('status')!r}")
        if not row.get("source_title"):
            errors.append(f"services/{row_id} has no source_title")
        if not isinstance(row.get("alt_categories"), list):
            errors.append(f"services/{row_id} alt_categories must be a list")
        elif not set(row["alt_categories"]).issubset(RESOURCE_CATEGORIES):
            errors.append(f"services/{row_id} has an invalid alt_categories value")

    for row in resources:
        row_id = row.get("id")
        if row.get("category") not in RESOURCE_CATEGORIES:
            errors.append(f"resources/{row_id} has invalid category {row.get('category')!r}")
        for field in ("address", "phone", "website", "description"):
            if not row.get(field):
                errors.append(f"resources/{row_id} has no {field}")
        if not isinstance(row.get("languages"), list):
            errors.append(f"resources/{row_id} languages must be a list")

    return errors


class SourceValidationError(RuntimeError):
    """A source URL could not be fetched successfully through PoliteClient."""


def validate_source_urls(services: list[dict], resources: list[dict]) -> int:
    # Keep the offline shape tests independent of network-only scraper dependencies.
    import requests
    sys.path.insert(0, str(SCRAPER_DIR))
    from polite import PoliteClient, RobotsDisallowed

    urls = sorted({row["source_url"] for row in services + resources if row.get("source_url")})
    client = PoliteClient()
    for url in urls:
        try:
            body = client.get_bytes(url, max_bytes=30_000_000)
        except (requests.RequestException, RobotsDisallowed, ValueError) as exc:
            raise SourceValidationError(f"could not fetch {url}: {exc}") from exc
        if not body:
            raise SourceValidationError(f"empty source response: {url}")
    return len(urls)


def main() -> int:
    services, resources = load_catalogs()
    errors = validate_catalogs(services, resources)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    try:
        checked_sources = validate_source_urls(services, resources)
    except SourceValidationError as exc:
        print(f"Source URL validation failed: {exc}", file=sys.stderr)
        return 1
    print(f"Catalog valid: {len(services)} services, {len(resources)} resources.")
    print(f"PoliteClient fetched {checked_sources} distinct source URLs successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
