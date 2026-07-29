"""CRM webhook receiver.

Auth here is the shared secret in X-CRM-Secret, NOT the owner JWT — the
caller is the CRM server, not a person. Every other endpoint in the app
stays behind require_owner.
"""
import hmac
import logging

from fastapi import APIRouter, Body, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import require_owner
from ..config import get_settings
from ..database import get_db
from ..modules import crm_data
from ..modules.crm_data import IngestError

log = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


def verify_crm_secret(x_crm_secret: str = Header(default="")) -> None:
    if not settings.crm_webhook_secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CRM webhook sozlanmagan: .env faylida CRM_WEBHOOK_SECRET to'ldiring.",
        )
    # compare_digest avoids leaking the secret through response timing
    if not hmac.compare_digest(x_crm_secret, settings.crm_webhook_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Noto'g'ri CRM kaliti")


@router.post("/webhook", dependencies=[Depends(verify_crm_secret)])
def webhook(payload: dict = Body(...), db: Session = Depends(get_db)):
    try:
        outcome, _ = crm_data.ingest_event(db, payload)
    except IngestError as e:
        # 400 so the CRM does not retry a payload that will never be valid
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"result": outcome}


@router.post("/backfill", dependencies=[Depends(verify_crm_secret)])
def backfill(payload: dict = Body(...), db: Session = Depends(get_db)):
    events = payload.get("events")
    if not isinstance(events, list):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="'events' ro'yxati kutilgan edi"
        )
    if len(events) > 5000:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Bir so'rovda 5000 tadan ko'p yozuv yubormang — bo'lib yuboring.",
        )
    return crm_data.ingest_batch(db, events)


@router.get("/health", dependencies=[Depends(require_owner)])
def health(db: Session = Depends(get_db)):
    """Owner-facing: is the CRM link alive?"""
    return crm_data.sync_health(db)
