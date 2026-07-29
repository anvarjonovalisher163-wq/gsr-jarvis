"""Instagram Insights storage — the same-batch upsert regression in
particular (metrics for today + follower snapshot must share one row)."""
from datetime import date, timedelta

from app.database import SessionLocal
from app.models import PageInsight
from app.modules import page_insights


def test_metrics_and_followers_share_todays_row(client):
    today = date.today()
    with SessionLocal() as db:
        db.query(PageInsight).delete()
        db.commit()

        per_day = {
            today - timedelta(days=1): {"reach": 500, "profile_views": 20},
            today: {"reach": 700, "profile_views": 30},
        }
        # followers snapshot lands on today's row created in the SAME batch —
        # this used to raise a UNIQUE constraint error
        result = page_insights.store_rows(db, per_day, followers_today=3400)
        assert result["created"] == 2

        rows = db.query(PageInsight).order_by(PageInsight.date).all()
        assert len(rows) == 2
        assert rows[-1].reach == 700 and rows[-1].followers == 3400


def test_resync_updates_in_place(client):
    today = date.today()
    with SessionLocal() as db:
        r = page_insights.store_rows(db, {today: {"reach": 999}}, followers_today=3500)
        assert r["created"] == 0 and r["updated"] >= 1
        row = db.query(PageInsight).filter(PageInsight.date == today).one()
        assert row.reach == 999 and row.followers == 3500


def test_summary_endpoint(client, owner_headers):
    s = client.get("/api/analytics/insights", headers=owner_headers).json()
    assert s["followers"] == 3500
    assert s["reach_total"] >= 999
    assert len(s["daily"]) >= 2


def test_sync_without_token_is_clean_400(client, owner_headers):
    r = client.post("/api/analytics/sync-insights", headers=owner_headers)
    assert r.status_code == 400
    assert "IG_BUSINESS_ID" in r.json()["detail"] or "META" in r.json()["detail"]
