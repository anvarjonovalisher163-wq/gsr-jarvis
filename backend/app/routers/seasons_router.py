"""Seasonal calendar endpoints (owner only)."""
from fastapi import APIRouter, Depends, Query

from ..auth import require_owner
from ..modules import seasons

router = APIRouter(dependencies=[Depends(require_owner)])


@router.get("/upcoming")
def upcoming(horizon: int = Query(90, ge=7, le=365)):
    return seasons.upcoming(horizon_days=horizon)
