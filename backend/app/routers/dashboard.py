"""Dashboard summary metrics for the Shtab tab."""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import require_owner
from ..database import get_db
from ..models import Competitor, ContentPost, IntelReport, PostStatus
from ..modules.content_factory import current_week_start
from ..schemas import DashboardOut

router = APIRouter(dependencies=[Depends(require_owner)])


@router.get("/summary", response_model=DashboardOut)
def summary(db: Session = Depends(get_db)):
    month_start = date.today().replace(day=1)
    week_start = current_week_start()

    def count(*where) -> int:
        return db.scalar(select(func.count()).select_from(ContentPost).where(*where)) or 0

    last_intel = db.scalars(select(IntelReport).order_by(IntelReport.id.desc()).limit(1)).first()

    return DashboardOut(
        week_posts=count(ContentPost.week_start == week_start),
        pending_review=count(
            ContentPost.status.in_([PostStatus.IDEA, PostStatus.DRAFT, PostStatus.REVIEW])
        ),
        approved=count(ContentPost.status == PostStatus.APPROVED),
        published_total=count(ContentPost.status == PostStatus.PUBLISHED),
        published_this_month=count(
            ContentPost.status == PostStatus.PUBLISHED, ContentPost.week_start >= month_start
        ),
        competitors=db.scalar(select(func.count()).select_from(Competitor)) or 0,
        last_intel_at=last_intel.created_at if last_intel else None,
    )
