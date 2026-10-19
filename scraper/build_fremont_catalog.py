"""Add source-backed Fremont parks and resident resources to shared/data.

All City pages are fetched through PoliteClient. This is append-only by stable ID; it
never deletes or renames existing catalog rows. After adding address-based rows, run
`python scraper/geocode.py` to fill U.S. Census coordinates where available.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

SCRAPER_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRAPER_DIR.parent
DATA_DIR = REPO_DIR / "shared" / "data"
sys.path.insert(0, str(SCRAPER_DIR))
from polite import PoliteClient

PARK_PAGES = (
    "https://www.fremont.gov/government/departments/parks-recreation/parks/park-locations",
    "https://www.fremont.gov/government/departments/parks-recreation/parks/park-locations/-npage-2-4461",
)
RESOURCE_CATEGORIES = {
    73: "Referral",  # Alameda County Offices
    83: "Community",  # City Facilities
    84: "Health",  # City-Funded Grants: Family Counseling & Support Services
    85: "Health",  # City-Funded Grants: Health-Related Services
    86: "Housing",  # City-Funded Grants: Homeless Services
    87: "Housing",  # City-Funded Grants: Housing-Related Public Service Grantees
    88: "Seniors",  # City-Funded Grants: Senior Services
    89: "Health",  # City-Funded Grants: Services for the Disabled
    90: "Health",  # Cooling Centers
    91: "Food",  # Farmers Markets
    92: "Referral",  # Fremont Family Resource Center Programs & Agencies
    94: "Food",  # Grocery
    95: "Community",  # Historic Attractions
    96: "Health",  # Hospitals
    97: "Housing",  # Housing
    98: "Library",  # Libraries
    100: "Community",  # Museums
    101: "Referral",  # New Resident
    102: "Referral",  # Other Government Agencies
    104: "Community",  # Performing Arts
    105: "Referral",  # Public Transit
    107: "Community",  # Schools
    108: "Crisis",  # Shelters
    109: "Seniors",  # Senior Transportation
    110: "Referral",  # Utilities
    211: "Legal",  # Legal Resources
}
CITY_RESOURCE_DIRECTORY = "https://www.fremont.gov/about/resource-directory"
RETRIEVED = date.today().isoformat()


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "item"


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def normalize_address(value: str) -> str:
    value = re.sub(r"\b(?:suite|ste|unit|building|bldg|#)\.?\s*[a-z0-9/]+", "", value, flags=re.IGNORECASE)
    return normalize(value)


def area_for(address: str) -> str:
    match = re.search(r"\b(94536|94538|94539|94555)\b", address)
    return match.group(1) if match else "citywide"


def parse_address(value: str) -> str:
    soup = BeautifulSoup(value or "", "html.parser")
    parts = [part.strip() for part in soup.get_text("\n").splitlines() if part.strip()]
    return ", ".join(parts)


def park_rows(client: PoliteClient) -> tuple[list[dict], list[str]]:
    rows: list[dict] = []
    skipped: list[str] = []
    for page_url in PARK_PAGES:
        soup = BeautifulSoup(client.get_text(page_url), "html.parser")
        title = soup.title.get_text(" ", strip=True) if soup.title else "Parks | City of Fremont"
        scripts = [script.string or script.get_text() for script in soup.find_all("script")]
        scripts = [script for script in scripts if "pagedFacilities.push" in script]
        matches = re.findall(r"pagedFacilities\.push\((.*?)\);", "\n".join(scripts), re.DOTALL)
        for raw in matches:
            try:
                facility = json.loads(raw)
                detail = json.loads(facility["content"])
            except (KeyError, json.JSONDecodeError) as exc:
                skipped.append(f"Park record could not be parsed: {exc}")
                continue
            name = html.unescape(detail.get("Name") or facility.get("title") or "").strip()
            address = parse_address(detail.get("Address", ""))
            if not name or not address:
                skipped.append(f"{name or 'Unnamed park'}: City directory has no address")
                continue
            lat, lng = facility.get("lat"), facility.get("lng")
            if lat is None or lng is None:
                skipped.append(f"{name}: directory has no coordinates; no map point added")
                continue
            phone = BeautifulSoup(detail.get("Phone", ""), "html.parser").get_text(" ", strip=True)
            rows.append({
                "id": f"svc-park-{slug(name)}",
                "name": name,
                "category": "parks",
                "status": "open",
                "area": area_for(address),
                "address": address,
                "location_note": "City of Fremont parks directory",
                "lat": float(lat),
                "lng": float(lng),
                "coords": "city-directory",
                "phone": phone or None,
                "hours": None,
                "summary": "The City of Fremont parks directory lists this park or recreation facility.",
                "detail": None,
                "cut_amount": None,
                "cut_amount_note": None,
                "effective_date": None,
                "updated_at": None,
                "action_label": None,
                "action_url": None,
                "alt_categories": [],
                "source_title": title,
                "source_url": page_url,
                "retrieved": RETRIEVED,
                "verified": True,
            })
    return rows, skipped


def resource_fields(card) -> dict[str, str]:
    fields: dict[str, str] = {}
    for label in card.select(".detail-list-label"):
        key = label.get_text(" ", strip=True).rstrip(":").lower()
        value = label.find_next(class_="detail-list-value")
        if not value:
            continue
        if key == "website":
            link = value.find("a", href=True)
            if link:
                fields[key] = urljoin("https://www.fremont.gov", link["href"].strip())
        else:
            fields[key] = value.get_text(" ", strip=True)
    return fields


def resource_rows(client: PoliteClient) -> tuple[list[dict], list[str]]:
    rows: list[dict] = []
    skipped: list[str] = []
    for category_id, category in RESOURCE_CATEGORIES.items():
        page_url = f"{CITY_RESOURCE_DIRECTORY}/-selcat-{category_id}-1526"
        soup = BeautifulSoup(client.get_text(page_url), "html.parser")
        selected = soup.select_one("#businessCats option[selected]")
        source_category = selected.get_text(" ", strip=True) if selected else "City of Fremont resource directory"
        for card in soup.select("ul.list-main > li"):
            title = card.select_one(".detail-title a")
            if not title:
                continue
            name = title.get_text(" ", strip=True)
            if normalize(name) == "policedepartment":
                skipped.append(f"{name}: City service entry is not an alternative resource")
                continue
            fields = resource_fields(card)
            address = re.sub(r"\s+", " ", fields.get("address", "")).strip()
            phone = fields.get("phone", "").strip()
            website = fields.get("website", "").strip()
            if not address or not phone or not website:
                skipped.append(f"{name}: directory does not publish address, phone, and website")
                continue
            digest = hashlib.sha1(f"{normalize(name)}|{normalize_address(address)}".encode()).hexdigest()[:7]
            rows.append({
                "id": f"res-{slug(name)[:48]}-{digest}",
                "name": name,
                "category": category,
                "area": area_for(address),
                "address": address,
                "lat": None,
                "lng": None,
                "coords": None,
                "phone": phone,
                "website": website,
                "hours": None,
                "description": (
                    f"The City of Fremont lists this provider under its {source_category} category. "
                    "Contact the provider to confirm current services, hours, and eligibility."
                ),
                "languages": [],
                "language_note": None,
                "source_url": page_url,
                "retrieved": RETRIEVED,
                "verified": True,
            })
    return rows, skipped


def main() -> int:
    client = PoliteClient()
    services_path = DATA_DIR / "services.json"
    resources_path = DATA_DIR / "resources.json"
    services = json.loads(services_path.read_text(encoding="utf-8"))
    resources = json.loads(resources_path.read_text(encoding="utf-8"))
    new_services, skipped_services = park_rows(client)
    new_resources, skipped_resources = resource_rows(client)

    # Reuse published City park points for resources at the same facilities.
    parks_by_name = {normalize(row["name"]): row for row in new_services}
    directory_point_ids = {
        "res-fremont-niles-farmers-market-852ac69": "niles town plaza historical park",
        "res-ardenwood-historic-farm-3dcbcba": "ardenwood regional preserve",
    }
    for row in new_resources:
        park_name = directory_point_ids.get(row["id"])
        if park_name and normalize(park_name) in parks_by_name:
            park = parks_by_name[normalize(park_name)]
            row["lat"], row["lng"], row["coords"] = park["lat"], park["lng"], "city-directory"

    # Mark unresolved local address points as approximate rather than presenting them as exact.
    old_frc = next((row for row in resources if row["id"] == "res-frc"), None)
    if old_frc and old_frc.get("lat") is not None and old_frc.get("lng") is not None:
        for row in new_resources:
            if "39155 Liberty St" in row["address"]:
                row["lat"], row["lng"], row["coords"] = old_frc["lat"], old_frc["lng"], "approximate"
    service_by_id = {row["id"]: row for row in services}
    manual_points = {
        "res-alameda-county-water-district-944f759": (37.507, -121.960),
        "res-development-services-center-d6d79df": (37.5510, -121.9825),
        "res-niles-canyon-railway-0483998": (37.5775, -121.9820),
        "res-california-school-for-the-deaf-99ad173": (37.563426, -121.964346),
    }
    for row in new_resources:
        if row["id"] in manual_points:
            row["lat"], row["lng"] = manual_points[row["id"]]
            row["coords"] = "approximate"
        elif row["id"] == "res-police-department-d1bd64b" and "svc-police-admin" in service_by_id:
            source = service_by_id["svc-police-admin"]
            row["lat"], row["lng"], row["coords"] = source["lat"], source["lng"], "approximate"

    service_ids = {row["id"] for row in services}
    service_names_addresses = {(normalize(row["name"]), normalize_address(row["address"])) for row in services}
    added_services = []
    for row in new_services:
        key = (normalize(row["name"]), normalize_address(row["address"]))
        if row["id"] not in service_ids and key not in service_names_addresses:
            added_services.append(row)
            service_ids.add(row["id"])
            service_names_addresses.add(key)

    resource_ids = {row["id"] for row in resources}
    existing_locations = {
        (normalize(row["name"]), normalize_address(row["address"]), re.sub(r"\D", "", row["phone"]))
        for row in resources
    }
    aliases = {
        "fremont main library": "fremont library",
        "tri-city health center": "bay area community health liberty clinic",
    }
    existing_names = [normalize(row["name"]) for row in resources]
    existing_name_phones = [
        (normalize(row["name"]), re.sub(r"\D", "", row["phone"])) for row in resources
    ]
    existing_address_phones = {
        (normalize_address(row["address"]), re.sub(r"\D", "", row["phone"])) for row in resources
    }
    duplicate_directory_names = {
        "abodeservicesformerlytricityhomelesscoalition",
        "fremontfamilyresourcecenterfrc",
        "fremontmainlibrary",
        "tricityhealthcenter",
    }
    added_resources = []
    seen_candidate_locations: set[tuple[str, str, str]] = set()
    for row in new_resources:
        name = normalize(row["name"])
        address = normalize_address(row["address"])
        phone = re.sub(r"\D", "", row["phone"])
        key = (name, address, phone)
        alias = aliases.get(name)
        duplicate = (
            row["id"] in resource_ids
            or key in existing_locations
            or key in seen_candidate_locations
            or (address, phone) in existing_address_phones
            or name in duplicate_directory_names
            or (alias is not None and alias in existing_names)
            or any(other_name == name and other_phone == phone for other_name, other_phone in existing_name_phones)
        )
        if duplicate:
            continue
        added_resources.append(row)
        resource_ids.add(row["id"])
        seen_candidate_locations.add(key)

    services.extend(added_services)
    resources.extend(added_resources)
    services_path.write_text(json.dumps(services, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    resources_path.write_text(json.dumps(resources, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added {len(added_services)} park services; {len(services)} total services.")
    print(f"Added {len(added_resources)} resources; {len(resources)} total resources.")
    for reason in dict.fromkeys(skipped_services + skipped_resources):
        print(f"Skipped: {reason}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
