"""Pydantic request/response schemas."""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# --- Auth ---
class LoginIn(BaseModel):
    login: str
    password: str


class TokenOut(BaseModel):
    token: str


# --- Chat ---
class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    created_at: datetime


# --- Content ---
class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    week_start: date
    pillar: str
    post_type: str
    title: str
    body: str
    body_ru: str
    hashtags: str
    best_time: str
    image_urls: str
    status: str
    ig_media_id: str
    created_at: datetime
    approved_at: datetime | None
    published_at: datetime | None


class PostPatch(BaseModel):
    title: str | None = None
    body: str | None = None
    body_ru: str | None = None
    hashtags: str | None = None
    best_time: str | None = None
    image_urls: list[str] | None = None


class GenerateIn(BaseModel):
    week_start: date | None = None


# --- Competitors ---
class CompetitorIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    platform: str = Field(pattern="^(instagram|telegram)$")
    handle: str = Field(min_length=1, max_length=120)


class CompetitorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    platform: str
    handle: str
    enabled: bool


class IntelReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_start: date
    period_end: date
    summary: str
    created_at: datetime


# --- Strategy ---
class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)


class AnswerOut(BaseModel):
    answer: str


class StrategyReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    month: str
    content: str
    created_at: datetime


# --- Push ---
class PushKeys(BaseModel):
    p256dh: str
    auth: str


class SubscriptionIn(BaseModel):
    endpoint: str
    keys: PushKeys


# --- Dashboard ---
class DashboardOut(BaseModel):
    week_posts: int
    pending_review: int
    approved: int
    published_total: int
    published_this_month: int
    competitors: int
    last_intel_at: datetime | None
