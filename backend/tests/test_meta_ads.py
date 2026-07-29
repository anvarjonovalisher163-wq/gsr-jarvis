"""Meta Ads ingestion and ROI joining (Graph API not called)."""
from datetime import date, timedelta

from app.database import SessionLocal
from app.models import AdSpend
from app.modules import meta_ads


def test_lead_action_parsing():
    assert meta_ads._extract_leads(None) == 0
    assert meta_ads._extract_leads([{"action_type": "link_click", "value": "9"}]) == 0
    assert (
        meta_ads._extract_leads(
            [
                {"action_type": "lead", "value": "2"},
                {"action_type": "onsite_conversion.lead_grouped", "value": "4"},
            ]
        )
        == 6
    )
    assert meta_ads._extract_leads([{"action_type": "lead", "value": "junk"}]) == 0


def test_segment_normalization():
    n = meta_ads.normalize_segment
    assert n("Meta Segment 1") == n("meta_segment_1")
    assert n("Segment — 2") == n("segment 2")
    assert n(None) == ""


def _row(day, adset_id, spend):
    return {
        "date_start": day.isoformat(),
        "campaign_id": "c1",
        "campaign_name": "ABO",
        "adset_id": adset_id,
        "adset_name": "Meta Segment 1",
        "spend": str(spend),
        "impressions": "1000",
        "clicks": "30",
        "actions": [{"action_type": "lead", "value": "3"}],
        "account_currency": "USD",
    }


def test_upsert_no_duplicates(client):
    day = date.today() - timedelta(days=400)
    with SessionLocal() as db:
        r1 = meta_ads.store_rows(db, [_row(day, "pytest-a", 10.0)])
        assert r1["created"] == 1
        r2 = meta_ads.store_rows(db, [_row(day, "pytest-a", 12.5)])
        assert r2["updated"] == 1 and r2["created"] == 0
        rows = db.query(AdSpend).filter(AdSpend.adset_id == "pytest-a").all()
        assert len(rows) == 1 and rows[0].spend == 12.5


def test_malformed_rows_skipped(client):
    with SessionLocal() as db:
        r = meta_ads.store_rows(db, [{"adset_id": "", "date_start": "2026-01-01"}, {}])
        assert r["skipped"] == 2


def test_roi_joins_spend_to_crm(client, crm_headers, owner_headers):
    # spend today under a name that normalizes to meta_segment_1
    with SessionLocal() as db:
        meta_ads.store_rows(db, [_row(date.today(), "pytest-roi", 100.0)])

    # a fresh lead from that segment, won
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    client.post(
        "/api/crm/webhook",
        headers=crm_headers,
        json={
            "event": "lead.created",
            "event_id": "roi-1",
            "occurred_at": now.isoformat(),
            "lead": {
                "id": "L-roi",
                "created_at": now.isoformat(),
                "status": "mijoz_boldi",
                "source": "meta_segment_1",
                "deal_amount": 900,
            },
        },
    )

    roi = client.get("/api/analytics/roi?days=7", headers=owner_headers).json()
    seg = next(s for s in roi["segments"] if s["segment"] == "Meta Segment 1")
    assert seg["matched"] is True
    assert seg["crm_leads"] >= 1 and seg["won"] >= 1
    assert seg["cost_per_sale"] is not None


def test_sync_without_token_is_clean_400(client, owner_headers):
    r = client.post("/api/analytics/sync-ads", headers=owner_headers)
    assert r.status_code == 400
    assert "META" in r.json()["detail"]
