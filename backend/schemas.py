"""Request bodies accepted by the API. Every field is validated before it reaches the store."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Area = Literal["citywide", "94536", "94538", "94539", "94555"]
ImpactLevel = Literal["low", "medium", "high"]
ServiceStatus = Literal["open", "reduced", "closed"]
AlertCategory = Literal["budget", "public_safety", "human_services", "infrastructure", "civic"]
LanguageCode = Literal["en", "es", "fa", "zh", "vi"]
EMAIL_PATTERN = r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Consented(Strict):
    """Shared by every form that stores what a person wrote.

    `consent` and `age_confirmed` must be ticked by the person. `website` is a honeypot: the
    field is hidden from people, so only a bot fills it in.
    """

    consent: bool
    age_confirmed: bool
    website: str = Field(default="", max_length=200)

    @model_validator(mode="after")
    def check_consent(self) -> Consented:
        if not self.consent:
            raise ValueError("consent_required")
        if not self.age_confirmed:
            raise ValueError("age_confirmation_required")
        return self


class ReportIn(Consented):
    service_id: str | None = Field(default=None, max_length=64)
    service_name: str = Field(min_length=2, max_length=160)
    area: Area = "citywide"
    description: str = Field(min_length=10, max_length=1000)
    impact_level: ImpactLevel


class PostIn(Consented):
    body: str = Field(min_length=3, max_length=280)
    area: Area = "citywide"


class FeedbackIn(Strict):
    kind: Literal["problem", "idea", "data_error"] = "problem"
    message: str = Field(min_length=5, max_length=1000)
    website: str = Field(default="", max_length=200)


class SubscriptionIn(Strict):
    categories: list[AlertCategory] = Field(default_factory=list, max_length=5)
    areas: list[Area] = Field(default_factory=list, max_length=5)
    notifications: bool = False

    @field_validator("categories", "areas")
    @classmethod
    def unique(cls, values: list[str]) -> list[str]:
        return sorted(set(values))


class EmailSubscribeIn(Consented):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=320)
    categories: list[AlertCategory] = Field(default_factory=list, max_length=5)
    areas: list[Area] = Field(default_factory=list, max_length=5)


class DeletionRequestIn(Strict):
    """Public form for people who have no install token (new phone, cleared browser, a parent)."""

    contact_email: str = Field(pattern=EMAIL_PATTERN, max_length=320)
    details: str = Field(min_length=10, max_length=1000)
    relationship: Literal["self", "parent_or_guardian"] = "self"
    consent: bool
    website: str = Field(default="", max_length=200)

    @model_validator(mode="after")
    def check_consent(self) -> DeletionRequestIn:
        if not self.consent:
            raise ValueError("consent_required")
        return self


# What a person may type, and how much of an earlier answer the app may send back as history.
MAX_QUESTION_CHARS = 2000
MAX_ANSWER_CHARS = 12000


class ChatTurn(Strict):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)

    @model_validator(mode="after")
    def _length(self) -> ChatTurn:
        if self.role == "user" and len(self.content) > MAX_QUESTION_CHARS:
            raise ValueError("too_long")
        # A long earlier answer is shortened, not rejected: rejecting it would end the conversation.
        if self.role == "assistant" and len(self.content) > MAX_ANSWER_CHARS:
            self.content = self.content[:MAX_ANSWER_CHARS]
        return self


class ChatIn(Strict):
    messages: list[ChatTurn] = Field(min_length=1, max_length=21)
    language: LanguageCode = "en"
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    area_label: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def last_turn_is_the_user(self) -> ChatIn:
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        return self

    def conversation(self) -> list[dict[str, str]]:
        """Turns to send to the model, oldest first; the API requires a user turn first."""
        turns = [turn.model_dump() for turn in self.messages]
        while turns and turns[0]["role"] != "user":
            turns.pop(0)
        return turns


class ModerateReportIn(Strict):
    status: Literal["verified", "rejected", "pending"]


class ModeratePostIn(Strict):
    status: Literal["approved", "rejected", "pending"]


class ServiceStatusIn(Strict):
    status: ServiceStatus
    summary: str | None = Field(default=None, min_length=10, max_length=400)


class DeletionRequestStatusIn(Strict):
    status: Literal["open", "completed"]
