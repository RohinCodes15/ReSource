import json
from functools import lru_cache
from math import asin, cos, radians, sin, sqrt
from typing import Optional

from config import FREMONT_CENTER, SHARED_DATA_DIR

EARTH_RADIUS_MI = 3958.8


@lru_cache(maxsize=None)
def _load(name: str) -> list[dict]:
    with open(SHARED_DATA_DIR / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def get_services() -> list[dict]:
    return _load("services")


def get_resources() -> list[dict]:
    return _load("resources")


def distance_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    d_lat, d_lon = radians(lat2 - lat1), radians(lon2 - lon1)
    h = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * EARTH_RADIUS_MI * asin(sqrt(h))


def nearby_resources(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    category: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 20,
) -> list[dict]:
    """Alternative resources sorted by distance from (lat, lng), defaulting to Fremont City Hall."""
    origin_lat, origin_lng = (lat, lng) if lat is not None and lng is not None else FREMONT_CENTER
    q = (query or "").strip().lower()
    out = []
    for r in get_resources():
        if category and r["category"].lower() != category.lower():
            continue
        if q and not any(q in r[k].lower() for k in ("name", "address", "category", "description")):
            continue
        out.append(
            {**r, "distance_miles": round(distance_miles(origin_lat, origin_lng, r["latitude"], r["longitude"]), 2)}
        )
    out.sort(key=lambda r: r["distance_miles"])
    return out[:limit]
