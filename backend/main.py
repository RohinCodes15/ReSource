"""FastAPI API for the ReSource Fremont civic-information app.

This file owns the app setup and the data routes (services, resources, reports, stats).
The AI chat route lives in routers/chat.py and the Supabase client in supabase_client.py.
"""
from __future__ import annotations

import math
import logging
import os
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from supabase import Client

from routers import chat
from supabase_client import supabase

logger = logging.getLogger("resource.api")

FREMONT_LAT = 37.5485
FREMONT_LNG = -121.9886

app = FastAPI(
    title="ReSource API",
    description="Fremont service, community resource, report, and chat API",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
# POST /chat (multilingual, Supabase-grounded, with conversation history).
app.include_router(chat.router)


class ServiceResponse(BaseModel):
    id: UUID
    name: str
    category: Literal["library", "transit", "recreation", "health", "education"]
    status: Literal["open", "reduced", "closed"]
    address: str
    lat: float
    lng: float
    description: str
    cut_amount: int
    effective_date: date | None = None
    created_at: datetime


class ResourceResponse(BaseModel):
    id: UUID
    name: str
    category: str
    address: str
    phone: str
    website: str
    lat: float
    lng: float
    description: str
    languages: list[str]
    distance_miles: float


class ReportCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    service_name: str = Field(min_length=1, max_length=160)
    address: str = Field(
        default="",
        max_length=300,
        validation_alias=AliasChoices("address", "location"),
    )
    description: str = Field(min_length=1, max_length=3000)
    impact_level: Literal["low", "medium", "high"] = "medium"


class ReportResponse(BaseModel):
    id: UUID
    status: Literal["pending", "verified", "rejected"]
    created_at: datetime


class StatsResponse(BaseModel):
    reports: int
    resources: int
    services_affected: int


def require_supabase() -> Client:
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API server.",
        )
    return supabase


def run_query(query):
    try:
        return query.execute()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Supabase request failed") from exc


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_miles = 3958.7613
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    return 2 * earth_radius_miles * math.asin(math.sqrt(min(1, a)))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": "configured" if supabase else "not_configured"}


@app.get("/services", response_model=list[ServiceResponse])
def get_services() -> list[dict]:
    response = run_query(require_supabase().table("services").select("*").order("name"))
    return response.data or []


@app.get("/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: UUID) -> dict:
    response = run_query(
        require_supabase().table("services").select("*").eq("id", str(service_id)).limit(1)
    )
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Service not found")
    return rows[0]


@app.get("/resources", response_model=list[ResourceResponse])
def get_resources(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
) -> list[dict]:
    if (lat is None) != (lng is None):
        raise HTTPException(status_code=422, detail="Provide both lat and lng, or neither")
    origin_lat = FREMONT_LAT if lat is None else lat
    origin_lng = FREMONT_LNG if lng is None else lng
    response = run_query(require_supabase().table("resources").select("*"))
    resources = response.data or []
    for resource in resources:
        resource["distance_miles"] = round(
            haversine_miles(origin_lat, origin_lng, resource["lat"], resource["lng"]), 2
        )
    return sorted(resources, key=lambda resource: resource["distance_miles"])


@app.post("/report", response_model=ReportResponse, status_code=201)
def create_report(report: ReportCreate) -> dict:
    payload = report.model_dump()
    payload["status"] = "pending"
    response = run_query(require_supabase().table("reports").insert(payload))
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=502, detail="Supabase did not return the created report")
    return rows[0]


@app.get("/stats", response_model=StatsResponse)
def get_stats() -> StatsResponse:
    db = require_supabase()
    report_count = run_query(db.table("reports").select("id", count="exact")).count or 0
    resource_count = run_query(db.table("resources").select("id", count="exact")).count or 0
    affected_count = run_query(
        db.table("services").select("id", count="exact").neq("status", "open")
    ).count or 0
    return StatsResponse(reports=report_count, resources=resource_count, services_affected=affected_count)
