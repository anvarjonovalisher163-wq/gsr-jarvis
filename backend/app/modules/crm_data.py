"""Module 1 — Data layer: CRM lead ingestion.

The CRM (a separate platform owned by the company) is the single source of
truth for leads. This module only writes what the CRM tells it via webhook.
Nothing here creates or mutates a lead on its own.

Webhook contract is documented in REJA.md.
"""
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Lead, LeadEvent, LeadStatus, to_utc, utcnow

log = logging.getLogger(__name__)

EVENT_CREATED = "lead.created"
EVENT_STAGE_CHANGED = "lead.stage_changed"
EVENT_UPDATED = "lead.updated"
EVENT_DELETED = "lead.deleted"
KNOWN_EVENTS = {EVENT_CREATED, EVENT_STAGE_CHANGED, EVENT_UPDATED, EVENT_DELETED}


class IngestError(Exception):
    """Payload the CRM sent cannot be processed. Message is owner-readable."""


def _parse_dt(value: str | None, fallback: datetime | None = None) -> datetime:
    if not value:
        if fallback is not None:
            return fallback
        return utcnow()
    try:
        # The CRM sends local time with an offset (+05:00); store UTC.
        return to_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        raise IngestError(f"Sana formati noto'g'ri: {value}")


def ingest_event(db: Session, payload: dict) -> tuple[str, Lead | None]:
    """Apply one webhook payload.

    Returns (outcome, lead) where outcome is "applied", "duplicate" or
    "ignored". Commits on success.
    """
    event_type = payload.get("event", "")
    if event_type not in KNOWN_EVENTS:
        raise IngestError("Noma'lum event turi: " + (event_type or "(bo'sh)"))

    lead_data = payload.get("lead") or {}
    crm_id = str(lead_data.get("id") or "").strip()
    if not crm_id:
        raise IngestError("lead.id majburiy maydon")

    event_id = payload.get("event_id")
    if event_id:
        event_id = str(event_id)
        seen = db.scalar(select(LeadEvent.id).where(LeadEvent.event_id == event_id))
        if seen:
            # Replayed delivery — the CRM is allowed to retry freely.
            return "duplicate", None

    occurred_at = _parse_dt(payload.get("occurred_at"))
    status = str(lead_data.get("status") or "").strip()
    if status and status not in LeadStatus.ALL:
        raise IngestError(f"Noma'lum status: {status}")

    lead = db.scalar(select(Lead).where(Lead.crm_id == crm_id))

    if event_type == EVENT_DELETED:
        if lead is None:
            return "ignored", None
        # Soft delete: analytics keeps the history, the lead drops out of
        # current counts.
        lead.is_deleted = True
        db.commit()
        return "applied", lead

    if lead is None:
        lead = Lead(
            crm_id=crm_id,
            status=status or LeadStatus.NEW,
            source=str(lead_data.get("source") or ""),
            referral_by=str(lead_data.get("referral_by") or ""),
            deal_amount=lead_data.get("deal_amount"),
            crm_created_at=_parse_dt(lead_data.get("created_at"), occurred_at),
            stage_changed_at=occurred_at,
        )
        db.add(lead)
        db.flush()  # assign lead.id for the event row below
        from_status = ""
    else:
        from_status = str(lead_data.get("previous_status") or lead.status)
        if status and status != lead.status:
            lead.status = status
            lead.stage_changed_at = occurred_at
        if "source" in lead_data and lead_data["source"] is not None:
            lead.source = str(lead_data["source"])
        if "referral_by" in lead_data:
            lead.referral_by = str(lead_data.get("referral_by") or "")
        if "deal_amount" in lead_data:
            lead.deal_amount = lead_data["deal_amount"]
        lead.is_deleted = False

    db.add(
        LeadEvent(
            lead_id=lead.id,
            event_id=event_id,
            event_type=event_type,
            from_status=from_status,
            to_status=status or lead.status,
            occurred_at=occurred_at,
        )
    )
    db.commit()
    return "applied", lead


def ingest_batch(db: Session, events: list[dict]) -> dict:
    """Backfill entry point. One bad row does not abort the whole load."""
    result = {"applied": 0, "duplicate": 0, "ignored": 0, "failed": 0, "errors": []}
    for i, payload in enumerate(events):
        try:
            outcome, _ = ingest_event(db, payload)
            result[outcome] += 1
        except IngestError as e:
            db.rollback()
            result["failed"] += 1
            if len(result["errors"]) < 20:
                result["errors"].append(f"#{i}: {e}")
    log.info("CRM backfill: %s", {k: v for k, v in result.items() if k != "errors"})
    return result


def sync_health(db: Session) -> dict:
    """Is the CRM actually talking to us? Surfaced on the dashboard so a
    silently broken webhook does not look like 'no leads this week'.

    Demo leads (seed_leads.py, crm_id starting with "demo-") do not count as
    a connection — otherwise sample data would masquerade as live CRM data.
    """
    real = db.scalar(
        select(Lead.id).where(Lead.crm_id.notlike("demo-%")).limit(1)
    )
    last = db.scalars(
        select(LeadEvent)
        .join(Lead, Lead.id == LeadEvent.lead_id)
        .where(Lead.crm_id.notlike("demo-%"))
        .order_by(LeadEvent.id.desc())
        .limit(1)
    ).first()
    return {
        "connected": real is not None,
        "last_event_at": last.received_at if last else None,
        "demo_data": db.scalar(select(Lead.id).where(Lead.crm_id.like("demo-%")).limit(1))
        is not None,
    }
