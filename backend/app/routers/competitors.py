"""Competitor list management + intel reports + manual runs."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_owner
from ..database import get_db
from ..models import Competitor, IntelReport
from ..modules import competitor_intel
from ..schemas import CompetitorIn, CompetitorOut, IntelReportOut

router = APIRouter(dependencies=[Depends(require_owner)])


@router.get("/", response_model=list[CompetitorOut])
def list_competitors(db: Session = Depends(get_db)):
    return db.scalars(select(Competitor).order_by(Competitor.id)).all()


@router.post("/", response_model=CompetitorOut)
def add_competitor(payload: CompetitorIn, db: Session = Depends(get_db)):
    comp = Competitor(
        name=payload.name, platform=payload.platform, handle=payload.handle.lstrip("@")
    )
    db.add(comp)
    db.commit()
    return comp


@router.delete("/{comp_id}")
def delete_competitor(comp_id: int, db: Session = Depends(get_db)):
    comp = db.get(Competitor, comp_id)
    if comp is None:
        raise HTTPException(404, detail="Raqobatchi topilmadi")
    db.delete(comp)
    db.commit()
    return {"ok": True}


@router.get("/reports", response_model=list[IntelReportOut])
def reports(limit: int = 10, db: Session = Depends(get_db)):
    return db.scalars(select(IntelReport).order_by(IntelReport.id.desc()).limit(limit)).all()


@router.post("/scrape")
async def scrape_now(db: Session = Depends(get_db)):
    """Manual scrape — works even when scheduled scraping is disabled."""
    new_posts = await competitor_intel.run_scrape(db)
    return {"new_posts": new_posts}


@router.post("/analyze", response_model=IntelReportOut)
async def analyze_now(db: Session = Depends(get_db)):
    report = await competitor_intel.run_weekly_analysis(db)
    if report is None:
        raise HTTPException(
            400,
            detail="So'nggi 7 kunda raqobatchi postlari yig'ilmagan — avval "
            "\"Skan qilish\" tugmasini bosing.",
        )
    return report
