"""Replace the app's approximate map positions with geocoded ones.

Uses the U.S. Census Bureau Geocoder, a free public government service with no API key:
https://geocoding.geo.census.gov/geocoder/

Why this script exists: on 2026-10-12 the Census geocoder's firewall rejected every request
from the development network, and the open geocoders built on OpenStreetMap (Nominatim,
Photon) disallow automated lookups in robots.txt, which this project obeys. So the
coordinates in shared/data were estimated by hand and every row is marked
`"coords": "approximate"`. Run this script from a home or school network to fix that.

Reads and rewrites, in place:
    shared/data/services.json
    shared/data/resources.json
Only `lat`, `lng` and `coords` change, and only on rows that have a street address. A row
that is geocoded gets `"coords": "census"`. Phone lines and PO boxes keep lat/lng = null.

Run:
    python scraper/geocode.py            # geocode every row still marked approximate
    python scraper/geocode.py --all      # re-check every row
    python scraper/geocode.py --dry-run  # show what would change, write nothing
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlencode

from polite import PoliteClient

REPO_DIR = Path(__file__).resolve().parent.parent
DATA_FILES = [REPO_DIR / "shared" / "data" / "services.json", REPO_DIR / "shared" / "data" / "resources.json"]
GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
# A real street address starts with a house number. "Phone service" or "PO Box 1170" do not.
STREET_ADDRESS_RE = re.compile(r"^\d+\s+\S+")
# Suite and building numbers confuse the geocoder and do not change where the door is.
UNIT_RE = re.compile(r",?\s*(?:\b(?:Suite|Ste|Building|Bldg|Unit)\b\.?|#)\s*[A-Za-z0-9/]+", re.I)
# Everything we list is in or next to Fremont; reject a match that lands somewhere else.
BOUNDS = {"lat": (37.40, 37.65), "lng": (-122.20, -121.80)}


def street_address(address: str) -> str | None:
    """The part of `address` the geocoder understands, or None if it is not a street address."""
    cleaned = UNIT_RE.sub("", address).strip()
    return cleaned if STREET_ADDRESS_RE.match(cleaned) else None


def geocode(client: PoliteClient, address: str) -> tuple[float, float, str] | None:
    query = urlencode({"address": address, "benchmark": "Public_AR_Current", "format": "json"})
    matches = client.get_json(f"{GEOCODER_URL}?{query}").get("result", {}).get("addressMatches", [])
    if not matches:
        return None
    lat, lng = float(matches[0]["coordinates"]["y"]), float(matches[0]["coordinates"]["x"])
    if not (BOUNDS["lat"][0] <= lat <= BOUNDS["lat"][1] and BOUNDS["lng"][0] <= lng <= BOUNDS["lng"][1]):
        return None
    return round(lat, 6), round(lng, 6), matches[0].get("matchedAddress", "")


def main() -> int:
    parser = argparse.ArgumentParser(description="Geocode services and resources with the U.S. Census Geocoder.")
    parser.add_argument("--all", action="store_true", help="re-check rows that are already geocoded")
    parser.add_argument("--dry-run", action="store_true", help="print the changes without writing files")
    args = parser.parse_args()

    client = PoliteClient(retries=1)
    failures = 0
    for path in DATA_FILES:
        rows = json.loads(path.read_text(encoding="utf-8"))
        changed = 0
        for row in rows:
            address = street_address(row.get("address") or "")
            if address is None or (row.get("coords") == "census" and not args.all):
                continue
            try:
                result = geocode(client, address)
            except Exception as exc:  # a firewall page or a timeout should not stop the rest
                client.log.warning("geocoder error for %s: %s", address, exc)
                result = None
            if result is None:
                failures += 1
                print(f"  no match: {row['id']}  {address}")
                continue
            lat, lng, matched = result
            changed += 1
            print(f"  {row['id']}: {lat}, {lng}  ({matched})")
            row["lat"], row["lng"], row["coords"] = lat, lng, "census"
        if changed and not args.dry_run:
            path.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{path.relative_to(REPO_DIR)}: {changed} row(s) {'would change' if args.dry_run else 'updated'}")
    if failures:
        print(f"{failures} address(es) were not geocoded and keep their approximate position.", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
