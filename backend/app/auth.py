"""Single-owner JWT authentication.

The owner's login and bcrypt password hash come from .env
(OWNER_LOGIN / OWNER_PASSWORD_HASH). There are no other users.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings

settings = get_settings()
_bearer = HTTPBearer(auto_error=False)


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_token() -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes)
    return jwt.encode({"sub": "owner", "exp": exp}, settings.jwt_secret, algorithm="HS256")


def require_owner(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Dependency guarding every private endpoint."""
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Avtorizatsiya talab qilinadi")
    try:
        payload = jwt.decode(cred.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Sessiya muddati tugagan — qayta kiring"
        )
    if payload.get("sub") != "owner":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Ruxsat yo'q")
    return payload
