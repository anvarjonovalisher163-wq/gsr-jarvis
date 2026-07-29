"""Module 1 (data layer) — own Instagram account statistics.

Pulls daily account-level metrics from the Instagram Insights API (official,
first-party — this is OUR account, no scraping involved) and stores one row
per day in page_insights.

Requires META_ACCESS_TOKEN with instagram_basic + instagram_manage_insights
and IG_BUSINESS_ID. Metric names occasionally change between Graph API
versions; each metric is fetched independently so one renamed metric does
not break the rest.
"""
import logging
from datetime import date, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import PageInsight

log = logging.getLogger(__name__)
settings = get_settings()

GRAPH_BASE = f"https://graph.facebook.com/{settings.meta_graph_version}"

# metric name -> PageInsight column
DAY_METRICS = {
    "reach": "reach",
    "profile_views": "profile_views",
    "website_clicks": "website_clicks",
}


class InsightsError(Exception):
    """Owner-readable (Uzbek) failure."""


def is_configured() -> bool:
    return bool(settings.meta_access_token and settings.ig_business_id)


def _require_configured() -> None:
    if not is_configured():
        raise InsightsError(
            "Instagram Insights sozlanmagan: .env faylida META_ACCESS_TOKEN va "
            "IG_BUSINESS_ID qiymatlarini to'ldiring."
        )


def _fetch_metric(client: httpx.Client, metric: str, since: date, until: date) -> dict[date, int]:
    """One metric's daily values. Failure of a single metric is logged and
    returns empty rather than aborting the whole sync."""
    r = client.get(
        f"{GRAPH_BASE}/{settings.ig_business_id}/insights",
        params={
            "metric": metric,
            "period": "day",
            "since": since.isoformat(),
            "until": until.isoformat(),
            "access_token": settings.meta_access_token,
        },
    )
    try:
        data = r.json()
    except ValueError:
        log.warning("Insights %s: non-JSON response (HTTP %s)", metric, r.status_code)
        return {}
    if "error" in data:
        log.warning("Insights %s: %s", metric, data["error"].get("message"))
        return {}

    out: dict[date, int] = {}
    for series in data.get("data", []):
        for point in series.get("values", []):
            end_time = point.get("end_time", "")
            try:
                day = datetime.fromisoformat(end_time.replace("Z", "+00:00")).date()
            except ValueError:
                continue
            try:
                out[day] = int(point.get("value") or 0)
            except (TypeError, ValueError):
                continue
    return out


def _fetch_followers(client: httpx.Client) -> int | None:
    r = client.get(
        f"{GRAPH_BASE}/{settings.ig_business_id}",
        params={"fields": "followers_count", "access_token": settings.meta_access_token},
    )
    try:
        data = r.json()
    except ValueError:
        return None
    if "error" in data:
        raise InsightsError("Meta API xatosi: " + data["error"].get("message", "noma'lum"))
    return data.get("followers_count")


def store_rows(db: Session, per_day: dict[date, dict], followers_today: int | None) -> dict:
    """Upsert daily metric rows. Follower count is a snapshot, written only
    onto today's row (the API has no follower history)."""
    touched: dict[date, PageInsight] = {}
    created_days: set[date] = set()

    def _row_for(day: date) -> PageInsight:
        # Look in this batch first — a row added moments ago is not yet
        # flushed, so a plain SELECT would miss it and we'd insert a
        # duplicate date (unique constraint violation).
        if day in touched:
            return touched[day]
        row = db.scalar(select(PageInsight).where(PageInsight.date == day))
        if row is None:
            row = PageInsight(date=day)
            db.add(row)
            created_days.add(day)
        touched[day] = row
        return row

    for day, values in sorted(per_day.items()):
        row = _row_for(day)
        for column, value in values.items():
            setattr(row, column, value)

    if followers_today is not None:
        _row_for(date.today()).followers = followers_today

    created = len(created_days)
    updated = len(touched) - created

    db.commit()
    result = {"created": created, "updated": updated}
    log.info("Insights sync: %s", result)
    return result


def sync(db: Session, days: int = 30) -> dict:
    _require_configured()
    until = date.today()
    since = until - timedelta(days=min(days, 30))  # API caps day-period ranges

    per_day: dict[date, dict] = {}
    with httpx.Client(timeout=60) as client:
        for metric, column in DAY_METRICS.items():
            for day, value in _fetch_metric(client, metric, since, until).items():
                per_day.setdefault(day, {})[column] = value
        followers = _fetch_followers(client)

    return store_rows(db, per_day, followers)


def summary(db: Session, days: int = 30) -> dict:
    """Dashboard payload: latest follower count, 30-day totals, daily series."""
    since = date.today() - timedelta(days=days)
    rows = db.scalars(
        select(PageInsight).where(PageInsight.date >= since).order_by(PageInsight.date.asc())
    ).all()

    followers_now = 0
    for row in reversed(rows):
        if row.followers:
            followers_now = row.followers
            break

    return {
        "configured": is_configured(),
        "days": days,
        "followers": followers_now,
        "reach_total": sum(r.reach for r in rows),
        "profile_views_total": sum(r.profile_views for r in rows),
        "website_clicks_total": sum(r.website_clicks for r in rows),
        "daily": [
            {"date": r.date.isoformat(), "reach": r.reach, "profile_views": r.profile_views}
            for r in rows
        ],
    }
