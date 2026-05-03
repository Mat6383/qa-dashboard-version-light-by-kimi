"""GitLab OAuth2 + JWT auth routes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_jwt
from app.database import get_main_db
from app.models.users import User
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

GITLAB_OAUTH_URL = f"{settings.gitlab_url.rstrip('/')}/oauth/authorize"
GITLAB_TOKEN_URL = f"{settings.gitlab_url.rstrip('/')}/oauth/token"
GITLAB_API_URL = f"{settings.gitlab_url.rstrip('/')}/api/v4"


@router.get("/gitlab")
async def gitlab_oauth_start() -> RedirectResponse:
    params = {
        "client_id": settings.gitlab_client_id,
        "redirect_uri": f"{settings.gitlab_url.rstrip('/')}/api/auth/gitlab/callback",
        "response_type": "code",
        "scope": "read_user openid profile email",
    }
    return RedirectResponse(url=f"{GITLAB_OAUTH_URL}?{urlencode(params)}")


@router.get("/gitlab/callback")
async def gitlab_oauth_callback(code: str, response: Response) -> RedirectResponse:
    # 1. Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GITLAB_TOKEN_URL,
            data={
                "client_id": settings.gitlab_client_id,
                "client_secret": settings.gitlab_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{settings.gitlab_url.rstrip('/')}/api/auth/gitlab/callback",
            },
        )
        if token_resp.status_code != 200:
            logger.error("GitLab token exchange failed: %s", token_resp.text)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitLab OAuth failed")

        token_data = token_resp.json()
        gitlab_access_token = token_data.get("access_token")
        if not gitlab_access_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No access token from GitLab")

        # 2. Fetch user profile
        user_resp = await client.get(
            f"{GITLAB_API_URL}/user",
            headers={"Authorization": f"Bearer {gitlab_access_token}"},
        )
        if user_resp.status_code != 200:
            logger.error("GitLab user fetch failed: %s", user_resp.text)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Failed to fetch GitLab user")

        gitlab_user = user_resp.json()

    # 3. Upsert user in DB
    async with get_main_db() as db:
        gitlab_id = gitlab_user["id"]
        email = gitlab_user.get("email") or f"{gitlab_user.get('username', 'unknown')}@gitlab.local"
        name = gitlab_user.get("name") or gitlab_user.get("username") or "GitLab User"
        avatar = gitlab_user.get("avatar_url")

        result = await db.execute(select(User).where(User.gitlab_id == gitlab_id))
        user = result.scalar_one_or_none()

        if user is None:
            # First user ever = admin
            count_result = await db.execute(select(User))
            count = len(count_result.scalars().all())
            role = "admin" if count == 0 else "viewer"

            user = User(
                gitlab_id=gitlab_id,
                email=email,
                name=name,
                avatar=avatar,
                role=role,
            )
            db.add(user)
        else:
            user.email = email
            user.name = name
            user.avatar = avatar
            user.last_login = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(user)

    # 4. Issue JWTs
    access = create_access_token(str(user.id), user.email, user.role)
    refresh = create_refresh_token(str(user.id))

    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/",
    )

    return RedirectResponse(
        url=f"{settings.frontend_url}/auth/callback?token={access}"
    )


@router.post("/refresh")
async def refresh_token(request: Request, response: Response) -> dict[str, Any]:
    refresh = request.cookies.get("refresh_token")
    if not refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    try:
        payload = decode_jwt(refresh)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = int(payload["sub"])
    async with get_main_db() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        access = create_access_token(str(user.id), user.email, user.role)
        response.set_cookie(
            key="access_token",
            value=access,
            httponly=True,
            secure=settings.environment == "production",
            samesite="strict",
            max_age=settings.access_token_expire_minutes * 60,
            path="/",
        )
        return {"access_token": access, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("access_token", path="/")
    return {"status": "logged_out"}


@router.get("/me")
async def me(request: Request) -> dict[str, Any]:
    token: str | None = None
    if request.headers.get("authorization", "").lower().startswith("bearer "):
        token = request.headers["authorization"][7:]
    else:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    try:
        payload = decode_jwt(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id = int(payload["sub"])
    async with get_main_db() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        return {
            "id": user.id,
            "gitlab_id": user.gitlab_id,
            "email": user.email,
            "name": user.name,
            "avatar": user.avatar,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
        }
