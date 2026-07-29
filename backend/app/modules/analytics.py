"""Module 2 — Analytics.

Reads only the mirrored CRM data (leads, lead_events) and computes the
numbers the owner asked for: lead statistics, funnel drop-off, stale leads
and referral quality.

Grouping is done in Python rather than SQL date functions on purpose:
strftime/date_trunc differ between SQLite and Postgres, and lead volume is
small enough that portability is worth more than pushing it into the query.
"""
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import AdSpend, Lead, LeadEvent, LeadStatus, to_utc, utcnow
from .meta_ads import normalize_segment

log = logging.getLogger(__name__)
settings = get_settings()


def _active_leads(db: Session) -> list[Lead]:
    return list(db.scalars(select(Lead).where(Lead.is_deleted.is_(False))).all())


def _period_key(dt: datetime, period: str) -> str:
    if period == "day":
        return dt.date().isoformat()
    if period == "year":
        return f"{dt.year}"
    return f"{dt.year}-{dt.month:02d}"


def overview(db: Session) -> dict:
    """Current state: how many leads sit in each stage right now."""
    rows = db.execute(
        select(Lead.status, func.count())
        .where(Lead.is_deleted.is_(False))
        .group_by(Lead.status)
    ).all()
    by_status = {status: count for status, count in rows}

    total = sum(by_status.values())
    won = by_status.get(LeadStatus.WON, 0)
    lost = by_status.get(LeadStatus.LOST, 0)
    in_progress = total - won - lost

    revenue = db.scalar(
        select(func.coalesce(func.sum(Lead.deal_amount), 0.0)).where(
            Lead.is_deleted.is_(False), Lead.status == LeadStatus.WON
        )
    )

    return {
        "total": total,
        "in_progress": in_progress,
        "won": won,
        "lost": lost,
        "conversion_pct": round(won / total * 100, 1) if total else 0.0,
        "revenue": float(revenue or 0),
        "by_status": [
            {
                "status": s,
                "label": LeadStatus.LABELS.get(s, s),
                "count": by_status.get(s, 0),
            }
            for s in LeadStatus.ORDER + [LeadStatus.LOST]
        ],
    }


def timeseries(db: Session, period: str = "month", limit: int = 12) -> list[dict]:
    """Cohort view: of the leads that arrived in each period, how many were
    won or lost. Answers 'oktyabrda tushgan leadlardan nechtasi sotildi'."""
    buckets: dict[str, dict] = defaultdict(lambda: {"leads": 0, "won": 0, "lost": 0})
    for lead in _active_leads(db):
        key = _period_key(lead.crm_created_at, period)
        buckets[key]["leads"] += 1
        if lead.status == LeadStatus.WON:
            buckets[key]["won"] += 1
        elif lead.status == LeadStatus.LOST:
            buckets[key]["lost"] += 1

    out = []
    for key in sorted(buckets, reverse=True)[:limit]:
        b = buckets[key]
        out.append(
            {
                "period": key,
                **b,
                "conversion_pct": round(b["won"] / b["leads"] * 100, 1) if b["leads"] else 0.0,
            }
        )
    return list(reversed(out))


def funnel(db: Session) -> list[dict]:
    """How many leads ever reached each stage, and where they fall out.

    Built from lead_events, so a lead that jumped straight from 'yangi' to
    'yoqotildi' is correctly counted as never having reached the middle
    stages.
    """
    reached: dict[str, set[int]] = {s: set() for s in LeadStatus.ORDER}
    for lead_id, to_status in db.execute(
        select(LeadEvent.lead_id, LeadEvent.to_status).join(Lead, Lead.id == LeadEvent.lead_id)
        .where(Lead.is_deleted.is_(False))
    ).all():
        if to_status in reached:
            reached[to_status].add(lead_id)

    # Every lead has been in "yangi" by definition, even if the CRM's first
    # event already carried a later stage.
    all_ids = {lead.id for lead in _active_leads(db)}
    reached[LeadStatus.NEW] |= all_ids

    out = []
    for i, stage in enumerate(LeadStatus.ORDER):
        count = len(reached[stage])
        nxt = LeadStatus.ORDER[i + 1] if i + 1 < len(LeadStatus.ORDER) else None
        dropped = count - len(reached[nxt]) if nxt else 0
        out.append(
            {
                "status": stage,
                "label": LeadStatus.LABELS[stage],
                "reached": count,
                "dropped_here": max(dropped, 0),
                "drop_pct": round(max(dropped, 0) / count * 100, 1) if count else 0.0,
            }
        )
    return out


def stale_leads(db: Session, days: int | None = None) -> dict:
    """Leads with no CRM movement for N days that are not won or lost."""
    days = days or settings.stale_lead_days
    cutoff = utcnow() - timedelta(days=days)
    rows = db.scalars(
        select(Lead)
        .where(
            Lead.is_deleted.is_(False),
            Lead.status.notin_(list(LeadStatus.TERMINAL)),
            Lead.stage_changed_at < cutoff,
        )
        .order_by(Lead.stage_changed_at.asc())
        .limit(200)
    ).all()

    now = utcnow()
    items = [
        {
            "crm_id": lead.crm_id,
            "status": lead.status,
            "label": LeadStatus.LABELS.get(lead.status, lead.status),
            "source": lead.source,
            "days_idle": (now - to_utc(lead.stage_changed_at)).days,
        }
        for lead in rows
    ]
    return {"days": days, "count": len(items), "items": items}


def by_source(db: Session) -> list[dict]:
    """Per-source performance. Once ad spend is connected this becomes the
    ROI table — the lead side of it is already here."""
    buckets: dict[str, dict] = defaultdict(lambda: {"leads": 0, "won": 0, "revenue": 0.0})
    for lead in _active_leads(db):
        key = lead.source or "(manba yo'q)"
        buckets[key]["leads"] += 1
        if lead.status == LeadStatus.WON:
            buckets[key]["won"] += 1
            buckets[key]["revenue"] += float(lead.deal_amount or 0)

    out = [
        {
            "source": k,
            **v,
            "conversion_pct": round(v["won"] / v["leads"] * 100, 1) if v["leads"] else 0.0,
        }
        for k, v in buckets.items()
    ]
    return sorted(out, key=lambda r: r["leads"], reverse=True)


def referral_quality(db: Session) -> dict:
    """Do referred leads convert better than the rest?"""
    groups = {
        "referral": {"leads": 0, "won": 0},
        "other": {"leads": 0, "won": 0},
    }
    for lead in _active_leads(db):
        key = "referral" if lead.is_referral else "other"
        groups[key]["leads"] += 1
        if lead.status == LeadStatus.WON:
            groups[key]["won"] += 1

    for g in groups.values():
        g["conversion_pct"] = round(g["won"] / g["leads"] * 100, 1) if g["leads"] else 0.0

    diff = groups["referral"]["conversion_pct"] - groups["other"]["conversion_pct"]
    return {**groups, "advantage_pct": round(diff, 1)}


def cycle_time(db: Session) -> dict:
    """Average days from first contact to a won deal."""
    first_seen: dict[int, datetime] = {}
    won_at: dict[int, datetime] = {}
    for lead_id, to_status, occurred_at in db.execute(
        select(LeadEvent.lead_id, LeadEvent.to_status, LeadEvent.occurred_at)
        .join(Lead, Lead.id == LeadEvent.lead_id)
        .where(Lead.is_deleted.is_(False))
        .order_by(LeadEvent.occurred_at.asc())
    ).all():
        occurred_at = to_utc(occurred_at)
        first_seen.setdefault(lead_id, occurred_at)
        if to_status == LeadStatus.WON:
            won_at.setdefault(lead_id, occurred_at)

    spans = [
        (won_at[lid] - first_seen[lid]).total_seconds() / 86400
        for lid in won_at
        if lid in first_seen
    ]
    return {
        "won_count": len(spans),
        "avg_days": round(sum(spans) / len(spans), 1) if spans else None,
    }


def roi(db: Session, days: int = 30) -> dict:
    """Ad spend joined to CRM outcomes, per ABO segment.

    The join key is the normalized ad-set name matched against the lead
    source. Rows that fail to match are reported separately instead of being
    dropped — a silent mismatch would quietly understate a segment's cost.
    """
    since = date.today() - timedelta(days=days)

    spend_rows = db.execute(
        select(
            AdSpend.adset_name,
            func.sum(AdSpend.spend),
            func.sum(AdSpend.impressions),
            func.sum(AdSpend.clicks),
            func.sum(AdSpend.meta_leads),
            func.max(AdSpend.currency),
        )
        .where(AdSpend.date >= since)
        .group_by(AdSpend.adset_name)
    ).all()

    since_dt = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)
    lead_stats: dict[str, dict] = defaultdict(lambda: {"leads": 0, "won": 0, "revenue": 0.0, "labels": set()})
    for lead in _active_leads(db):
        if to_utc(lead.crm_created_at) < since_dt:
            continue
        key = normalize_segment(lead.source)
        bucket = lead_stats[key]
        bucket["leads"] += 1
        bucket["labels"].add(lead.source or "(manba yo'q)")
        if lead.status == LeadStatus.WON:
            bucket["won"] += 1
            bucket["revenue"] += float(lead.deal_amount or 0)

    segments = []
    matched_keys = set()
    currency = "USD"
    for adset_name, spend, impressions, clicks, meta_leads, cur in spend_rows:
        key = normalize_segment(adset_name)
        matched_keys.add(key)
        currency = cur or currency
        crm = lead_stats.get(key, {"leads": 0, "won": 0, "revenue": 0.0})
        spend = float(spend or 0)
        segments.append(
            {
                "segment": adset_name,
                "spend": round(spend, 2),
                "impressions": int(impressions or 0),
                "clicks": int(clicks or 0),
                "meta_leads": int(meta_leads or 0),
                "crm_leads": crm["leads"],
                "won": crm["won"],
                "revenue": round(crm["revenue"], 2),
                "cost_per_lead": round(spend / crm["leads"], 2) if crm["leads"] else None,
                "cost_per_sale": round(spend / crm["won"], 2) if crm["won"] else None,
                "roi_pct": (
                    round((crm["revenue"] - spend) / spend * 100, 1) if spend > 0 else None
                ),
                "matched": key in lead_stats,
            }
        )

    segments.sort(key=lambda s: s["spend"], reverse=True)

    # Leads whose source never appears in ad spend — organic, referral, or a
    # naming mismatch the owner needs to see.
    unmatched_sources = [
        {"source": sorted(v["labels"])[0], "leads": v["leads"], "won": v["won"]}
        for k, v in lead_stats.items()
        if k not in matched_keys and v["leads"] > 0
    ]
    unmatched_sources.sort(key=lambda r: r["leads"], reverse=True)

    return {
        "days": days,
        "currency": currency,
        "total_spend": round(sum(s["spend"] for s in segments), 2),
        "total_won": sum(s["won"] for s in segments),
        "segments": segments,
        "unmatched_sources": unmatched_sources,
        "advice": _budget_advice(segments),
    }


def _budget_advice(segments: list[dict]) -> list[dict]:
    """Plain arithmetic, not AI: where to add budget and what to pause.

    Deliberately rule-based so the owner can verify the reasoning. The AI
    strategy module reads these same numbers separately.
    """
    spending = [s for s in segments if s["spend"] > 0]
    if not spending:
        return []

    with_sales = [s for s in spending if s["cost_per_sale"] is not None]
    advice = []

    for s in spending:
        if s["won"] == 0 and s["crm_leads"] == 0:
            advice.append(
                {
                    "segment": s["segment"],
                    "action": "tekshiring",
                    "reason": "Xarajat bor, lekin CRM'da bu manbadan lid yo'q — "
                    "nomlanish mos kelmayotgan bo'lishi mumkin.",
                }
            )
        elif s["won"] == 0:
            advice.append(
                {
                    "segment": s["segment"],
                    "action": "to'xtatib turing",
                    "reason": f"{s['crm_leads']} ta lid keldi, lekin birortasi ham sotuvga aylanmadi.",
                }
            )

    if len(with_sales) >= 2:
        best = min(with_sales, key=lambda s: s["cost_per_sale"])
        worst = max(with_sales, key=lambda s: s["cost_per_sale"])
        if best["segment"] != worst["segment"]:
            advice.append(
                {
                    "segment": best["segment"],
                    "action": "byudjet qo'shing",
                    "reason": f"Bitta sotuv {best['cost_per_sale']} turmoqda — eng arzoni.",
                }
            )
            if worst["cost_per_sale"] >= best["cost_per_sale"] * 2:
                advice.append(
                    {
                        "segment": worst["segment"],
                        "action": "kamaytiring",
                        "reason": f"Bitta sotuv {worst['cost_per_sale']} turmoqda — "
                        f"eng arzon segmentdan qimmatroq.",
                    }
                )
    return advice


def full_report(db: Session) -> dict:
    """Everything the dashboard needs in one call."""
    return {
        "overview": overview(db),
        "monthly": timeseries(db, "month", 12),
        "funnel": funnel(db),
        "stale": stale_leads(db),
        "sources": by_source(db),
        "referral": referral_quality(db),
        "cycle": cycle_time(db),
        "roi": roi(db),
    }
