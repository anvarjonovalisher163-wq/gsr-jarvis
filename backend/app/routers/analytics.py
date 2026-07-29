"""Lead analytics endpoints (owner only)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import require_owner
from ..database import get_db
from ..modules import analytics, meta_ads, page_insights
from ..modules.meta_ads import MetaAdsError
from ..modules.page_insights import InsightsError

router = APIRouter(dependencies=[Depends(require_owner)])


@router.get("/report")
def report(db: Session = Depends(get_db)):
    """Everything the dashboard needs in one request."""
    return analytics.full_report(db)


@router.get("/timeseries")
def timeseries(
    period: str = Query("month", pattern="^(day|month|year)$"),
    limit: int = Query(12, ge=1, le=365),
    db: Session = Depends(get_db),
):
    return analytics.timeseries(db, period, limit)


@router.get("/stale")
def stale(
    days: int | None = Query(None, ge=1, le=365),
    db: Session = Depends(get_db),
):
    return analytics.stale_leads(db, days)


@router.get("/roi")
def roi(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db)):
    return analytics.roi(db, days)


@router.post("/sync-ads")
def sync_ads(days: int = Query(30, ge=1, le=90), db: Session = Depends(get_db)):
    """Pull the latest Meta Ads spend on demand."""
    try:
        return meta_ads.sync(db, days)
    except MetaAdsError as e:
        raise HTTPException(400, detail=str(e))


@router.get("/ads-status")
def ads_status():
    return {"configured": meta_ads.is_configured()}


@router.get("/insights")
def insights(days: int = Query(30, ge=7, le=90), db: Session = Depends(get_db)):
    """Our own Instagram account statistics."""
    return page_insights.summary(db, days)


@router.post("/sync-insights")
def sync_insights(db: Session = Depends(get_db)):
    try:
        return page_insights.sync(db)
    except InsightsError as e:
        raise HTTPException(400, detail=str(e))
