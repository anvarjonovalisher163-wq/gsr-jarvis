"""Web Push subscription endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_owner
from ..config import get_settings
from ..database import get_db
from ..models import PushSubscription
from ..schemas import SubscriptionIn

router = APIRouter(dependencies=[Depends(require_owner)])
settings = get_settings()


@router.get("/vapid-key")
def vapid_key():
    return {"key": settings.vapid_public_key}


@router.post("/subscribe")
def subscribe(payload: SubscriptionIn, db: Session = Depends(get_db)):
    existing = db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    if existing:
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
    else:
        db.add(
            PushSubscription(
                endpoint=payload.endpoint,
                p256dh=payload.keys.p256dh,
                auth=payload.keys.auth,
            )
        )
    db.commit()
    return {"ok": True}
