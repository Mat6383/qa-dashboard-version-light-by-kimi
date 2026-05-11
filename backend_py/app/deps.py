"""FastAPI dependencies : DB sessions, auth, admin checks."""

from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import decode_jwt
from app.database import get_comments_db, get_main_db
from app.models.users import User

security_bearer = HTTPBearer(auto_error=False)


async def get_db_main():
    async with get_main_db() as session:
        yield session


async def get_db_comments():
    async with get_comments_db() as session:
        yield session


DBMain = Annotated[AsyncSession, Depends(get_db_main)]
DBComments = Annotated[AsyncSession, Depends(get_db_comments)]


async def require_auth(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)] = None,
) -> User:
    token: str | None = None
    if credentials:
        token = credentials.credentials
    else:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    try:
        payload = decode_jwt(token)
    except JWTError:
        # Fallback to cookie if Bearer token is invalid
        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        payload = decode_jwt(token)

    user_id = int(payload.get("sub", 0))
    async with get_main_db() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user


async def require_admin(user: Annotated[User, Depends(require_auth)]) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return user


async def require_admin_token(x_admin_token: Annotated[str | None, Header()] = None) -> None:
    if not x_admin_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing admin token")
    if not hmac.compare_digest(x_admin_token, settings.admin_api_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin token")


async def require_admin_or_token(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)] = None,
    x_admin_token: Annotated[str | None, Header()] = None,
) -> User:
    """Accept JWT admin auth OR X-Admin-Token (machine-to-machine / e2e)."""
    # 1. Try JWT Bearer
    token: str | None = None
    if credentials:
        token = credentials.credentials
    else:
        token = request.cookies.get("access_token")

    if token:
        try:
            payload = decode_jwt(token)
            user_id = int(payload.get("sub", 0))
            async with get_main_db() as db:
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if user is not None and user.role == "admin":
                    return user
        except Exception:
            pass

    # 2. Fallback X-Admin-Token
    if x_admin_token and hmac.compare_digest(x_admin_token, settings.admin_api_token):
        return User(
            id=0,
            gitlab_id=0,
            email="admin@system",
            name="Admin",
            role="admin",
            avatar=None,
        )

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise")
