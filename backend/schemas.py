from typing import Literal, Optional

from pydantic import BaseModel, Field


class Service(BaseModel):
    id: str
    name: str
    category: str
    address: str
    latitude: float
    longitude: float
    change: str
    effective: str
    details: str
    status: Literal["reduced", "suspended", "closed", "cancelled"]


class Resource(BaseModel):
    id: str
    name: str
    category: str
    address: str
    latitude: float
    longitude: float
    phone: str
    hours: str
    description: str
    distance_miles: Optional[float] = None


class ReportIn(BaseModel):
    service_name: str = Field(min_length=1, max_length=200)
    location: str = Field(default="", max_length=300)
    description: str = Field(min_length=1, max_length=2000)
    photo_uri: Optional[str] = Field(default=None, max_length=2000)


class ReportOut(BaseModel):
    id: str
    status: Literal["received"]
    stored_in: Literal["supabase", "memory"]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


class ChatOut(BaseModel):
    reply: str
    source: Literal["openai", "fallback"]
