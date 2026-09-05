import hashlib
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from pwdlib import PasswordHash
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import User

password_hash = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return password_hash.verify(password, hashed)


def create_token(user_id: uuid.UUID, kind: str, expires: timedelta) -> str:
    now = datetime.now(UTC)
    return jwt.encode({"sub": str(user_id), "type": kind, "jti": str(uuid.uuid4()), "iat": now, "exp": now + expires}, settings.jwt_secret, algorithm="HS256")


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")
    if credentials is None:
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise unauthorized
        user = await session.get(User, uuid.UUID(payload["sub"]))
    except (InvalidTokenError, KeyError, ValueError):
        raise unauthorized from None
    if user is None or not user.is_active:
        raise unauthorized
    return user
