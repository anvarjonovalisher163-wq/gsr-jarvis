"""Database models."""
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_utc(dt: datetime) -> datetime:
    """Normalize a datetime to timezone-aware UTC.

    SQLite silently drops tzinfo on write, so a value that arrived as
    +05:00 would otherwise be stored as Tashkent wall-clock time and then
    read back as if it were UTC — a five-hour skew in every duration we
    compute. Convert on the way in, re-attach UTC on the way out.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class PostStatus:
    """Content lifecycle: idea -> draft -> review -> approved -> published.
    A post may also be rejected at any pre-published step."""

    IDEA = "idea"
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"

    ALL = {IDEA, DRAFT, REVIEW, APPROVED, REJECTED, PUBLISHED}


class ContentPost(Base):
    __tablename__ = "content_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    week_start: Mapped[date] = mapped_column(Date, index=True)
    pillar: Mapped[str] = mapped_column(String(160), default="")
    post_type: Mapped[str] = mapped_column(String(20), default="post")  # post|carousel|reels
    title: Mapped[str] = mapped_column(String(255), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    hashtags: Mapped[str] = mapped_column(Text, default="")
    # Russian version of the copy, generated alongside the Uzbek body.
    # Empty on posts created before bilingual generation was added.
    body_ru: Mapped[str] = mapped_column(Text, default="")
    best_time: Mapped[str] = mapped_column(String(64), default="")
    image_urls: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of public URLs
    status: Mapped[str] = mapped_column(String(20), default=PostStatus.REVIEW, index=True)
    ig_media_id: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LeadStatus:
    """CRM voronka bosqichlari. Kodlar CRM bilan kelishilgan webhook
    shartnomasidan olingan (REJA.md)."""

    NEW = "yangi"
    CONTACTED = "boglanildi"
    QUOTED = "narx_aytildi"
    AWAITING = "javob_kutilmoqda"
    CALCULATING = "xisoblashga_berildi"
    WON = "mijoz_boldi"
    LOST = "yoqotildi"

    # Funnel order as shown in the CRM UI. Drop-off analysis walks this list,
    # so if the CRM reorders its pipeline, change it here.
    ORDER = [NEW, CONTACTED, QUOTED, AWAITING, CALCULATING, WON]
    TERMINAL = {WON, LOST}
    ALL = set(ORDER) | {LOST}

    LABELS = {
        NEW: "Yangi",
        CONTACTED: "Bog'lanildi",
        QUOTED: "Narx aytildi",
        AWAITING: "Javob kutilmoqda",
        CALCULATING: "Xisoblashga berildi",
        WON: "Mijoz bo'ldi",
        LOST: "Yo'qotildi",
    }


class Lead(Base):
    """Mirror of a CRM lead. The CRM is the single source of truth — this
    table is written only from incoming webhooks / backfill, never by a user
    action inside Jarvis."""

    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    crm_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), index=True, default=LeadStatus.NEW)
    source: Mapped[str] = mapped_column(String(120), default="", index=True)
    referral_by: Mapped[str] = mapped_column(String(120), default="")
    deal_amount: Mapped[float | None] = mapped_column(nullable=True)
    crm_created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    stage_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(default=False)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    @property
    def is_referral(self) -> bool:
        return bool(self.referral_by.strip())


class LeadEvent(Base):
    """One row per CRM change. This is what makes sales-cycle analysis
    possible — without it we only ever know the current stage."""

    __tablename__ = "lead_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    # CRM-supplied id; unique so a replayed webhook is ignored rather than double-counted
    event_id: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True)
    event_type: Mapped[str] = mapped_column(String(32))
    from_status: Mapped[str] = mapped_column(String(32), default="")
    to_status: Mapped[str] = mapped_column(String(32), default="")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AdSpend(Base):
    """Daily Meta Ads numbers at ad-set level. ABO campaigns run one ad set
    per audience segment, so ad_set_name is the segment."""

    __tablename__ = "ad_spend"
    __table_args__ = (UniqueConstraint("date", "adset_id", name="uq_spend_day_adset"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    campaign_id: Mapped[str] = mapped_column(String(64), default="")
    campaign_name: Mapped[str] = mapped_column(String(255), default="")
    adset_id: Mapped[str] = mapped_column(String(64), index=True)
    adset_name: Mapped[str] = mapped_column(String(255), default="", index=True)
    spend: Mapped[float] = mapped_column(default=0.0)
    impressions: Mapped[int] = mapped_column(default=0)
    clicks: Mapped[int] = mapped_column(default=0)
    meta_leads: Mapped[int] = mapped_column(default=0)  # leads as counted by Meta
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class PageInsight(Base):
    """Daily snapshot of our own Instagram business account metrics
    (Insights API). One row per day."""

    __tablename__ = "page_insights"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    reach: Mapped[int] = mapped_column(default=0)
    profile_views: Mapped[int] = mapped_column(default=0)
    website_clicks: Mapped[int] = mapped_column(default=0)
    followers: Mapped[int] = mapped_column(default=0)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(12))  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Competitor(Base):
    __tablename__ = "competitors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    platform: Mapped[str] = mapped_column(String(20))  # "instagram" | "telegram"
    handle: Mapped[str] = mapped_column(String(120))   # username without @
    enabled: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CompetitorPost(Base):
    __tablename__ = "competitor_posts"
    __table_args__ = (UniqueConstraint("competitor_id", "external_id", name="uq_comp_post"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    competitor_id: Mapped[int] = mapped_column(ForeignKey("competitors.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(String(160))
    caption: Mapped[str] = mapped_column(Text, default="")
    engagement: Mapped[int] = mapped_column(default=0)  # views/likes, best available signal
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class IntelReport(Base):
    __tablename__ = "intel_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    summary: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StrategyReport(Base):
    __tablename__ = "strategy_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    month: Mapped[str] = mapped_column(String(7))  # "2026-08"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    endpoint: Mapped[str] = mapped_column(Text, unique=True)
    p256dh: Mapped[str] = mapped_column(String(255))
    auth: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
