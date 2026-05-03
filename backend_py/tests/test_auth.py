"""Auth endpoint tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, create_refresh_token
from app.database import get_main_db
from app.models.users import User


@pytest.mark.asyncio
async def test_me_without_token(client: AsyncClient) -> None:
    response = await client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing token"


@pytest.mark.asyncio
async def test_me_with_valid_token(client: AsyncClient) -> None:
    async with get_main_db() as db:
        user = User(
            gitlab_id=999001,
            email="auth_test@example.com",
            name="Auth Test",
            role="viewer",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_access_token(str(user.id), user.email, user.role)
    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "auth_test@example.com"
    assert data["role"] == "viewer"

    # cleanup
    async with get_main_db() as db:
        await db.delete(user)
        await db.commit()


@pytest.mark.asyncio
async def test_refresh_without_cookie(client: AsyncClient) -> None:
    response = await client.post("/api/auth/refresh")
    assert response.status_code == 401
    assert response.json()["detail"] == "No refresh token"


@pytest.mark.asyncio
async def test_logout_clears_cookie(client: AsyncClient) -> None:
    response = await client.post("/api/auth/logout")
    assert response.status_code == 200
    set_cookie = response.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie or "Max-Age=0" in set_cookie
