"""Module 1 (data layer) — Meta Ads spend ingestion.

Pulls daily ad-set level insights from the Marketing API and stores them in
ad_spend. ABO campaigns run one ad set per audience segment, so ad_set_name
carries the segment identity used later when joining against CRM leads.

Requires META_ACCESS_TOKEN with ads_read and META_AD_ACCOUNT_ID. Without
them every entry point raises a readable error instead of failing silently.
"""
import logging
import re
from datetime import date, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import AdSpend

log = logging.getLogger(__name__)
settings = get_settings()

GRAPH_BASE = f"https://graph.facebook.com/{settings.meta_graph_version}"

FIELDS = ",".join(
    [
        "campaign_id",
        "campaign_name",
        "adset_id",
        "adset_name",
        "spend",
        "impressions",
        "clicks",
        "actions",
        "account_currency",
    ]
)


class MetaAdsError(Exception):
    """Owner-readable (Uzbek) failure."""


def is_configured() -> bool:
    return bool(settings.meta_access_token and settings.meta_ad_account_id)


def _account_path() -> str:
    acc = settings.meta_ad_account_id.strip()
    return acc if acc.startswith("act_") else f"act_{acc}"


def normalize_segment(name: str) -> str:
    """Key used to match a Meta ad set against a CRM lead source.

    Naming rarely matches character for character between the two systems
    ("Segment 2 — Importyorlar" vs "meta_segment_2"), so both sides are
    reduced to lowercase alphanumerics before comparison. Anything that
    still does not match is reported rather than silently dropped.
    """
    return re.sub(r"[^a-z0-9]+", "", (name or "").lower())


def _extract_leads(actions: list[dict] | None) -> int:
    """Meta reports conversions in an `actions` list with varying action_type
    names (lead, onsite_conversion.lead_grouped, ...). Sum anything that is
    a lead action."""
    if not actions:
        return 0
    total = 0
    for a in actions:
        action_type = a.get("action_type", "")
        if "lead" in action_type:
            try:
                total += int(float(a.get("value", 0)))
            except (TypeError, ValueError):
                continue
    return total


def fetch_insights(since: date, until: date) -> list[dict]:
    """Raw daily ad-set rows from the Marketing API, following pagination."""
    if not is_configured():
        raise MetaAdsError(
            "Meta Ads sozlanmagan: .env faylida META_ACCESS_TOKEN va "
            "META_AD_ACCOUNT_ID qiymatlarini to'ldiring."
        )

    url = f"{GRAPH_BASE}/{_account_path()}/insights"
    params = {
        "level": "adset",
        "time_increment": 1,
        "time_range": f'{{"since":"{since.isoformat()}","until":"{until.isoformat()}"}}',
        "fields": FIELDS,
        "limit": 500,
        "access_token": settings.meta_access_token,
    }

    rows: list[dict] = []
    with httpx.Client(timeout=60) as client:
        page = 0
        while url and page < 50:  # hard stop so a paging bug cannot loop forever
            r = client.get(url, params=params if page == 0 else None)
            try:
                data = r.json()
            except ValueError:
                raise MetaAdsError(f"Meta API kutilmagan javob qaytardi (HTTP {r.status_code})")
            if "error" in data:
                raise MetaAdsError("Meta API xatosi: " + data["error"].get("message", "noma'lum"))
            rows.extend(data.get("data", []))
            url = (data.get("paging") or {}).get("next")
            page += 1
    return rows


def store_rows(db: Session, rows: list[dict]) -> dict:
    """Upsert raw insight rows into ad_spend. Re-running for the same dates
    updates in place — Meta revises recent numbers for a few days."""
    created = updated = skipped = 0
    for row in rows:
        adset_id = str(row.get("adset_id") or "")
        day = row.get("date_start")
        if not adset_id or not day:
            skipped += 1
            continue
        try:
            day_value = date.fromisoformat(day)
        except ValueError:
            skipped += 1
            continue

        values = {
            "campaign_id": str(row.get("campaign_id") or ""),
            "campaign_name": str(row.get("campaign_name") or ""),
            "adset_name": str(row.get("adset_name") or ""),
            "spend": float(row.get("spend") or 0),
            "impressions": int(float(row.get("impressions") or 0)),
            "clicks": int(float(row.get("clicks") or 0)),
            "meta_leads": _extract_leads(row.get("actions")),
            "currency": str(row.get("account_currency") or "USD"),
        }

        existing = db.scalar(
            select(AdSpend).where(AdSpend.date == day_value, AdSpend.adset_id == adset_id)
        )
        if existing:
            for k, v in values.items():
                setattr(existing, k, v)
            updated += 1
        else:
            db.add(AdSpend(date=day_value, adset_id=adset_id, **values))
            created += 1

    db.commit()
    result = {"created": created, "updated": updated, "skipped": skipped}
    log.info("Meta Ads sync: %s", result)
    return result


def sync(db: Session, days: int = 30) -> dict:
    """Pull the last N days. Meta adjusts recent figures, so overlapping
    re-syncs are expected and safe."""
    until = date.today()
    since = until - timedelta(days=days)
    return store_rows(db, fetch_insights(since, until))
