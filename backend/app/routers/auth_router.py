"""Owner login endpoint."""
from fastapi import APIRouter, HTTPException

from ..auth import create_token, verify_password
from ..config import get_settings
from ..schemas import LoginIn, TokenOut

router = APIRouter()
settings = get_settings()


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn):
    ok = payload.login == settings.owner_login and verify_password(
        payload.password, settings.owner_password_hash
    )
    if not ok:
        raise HTTPException(401, detail="Login yoki parol noto'g'ri")
    return TokenOut(token=create_token())
