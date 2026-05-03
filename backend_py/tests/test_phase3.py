"""Phase 3 endpoint tests — routers, DB CRUD, SSE headers, WebSocket."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from app.core.security import create_access_token
from app.database import get_comments_db, get_main_db
from app.models.audit import AuditLog
from app.models.comments import CrossTestComment
from app.models.feature_flags import FeatureFlag
from app.models.notifications import NotificationSetting
from app.models.users import User
from app.models.webhooks import WebhookSubscription


# ── helpers ─────────────────────────────────────────────

async def _make_admin() -> User:
    async with get_main_db() as db:
        user = User(
            gitlab_id=900000 + hash(uuid.uuid4().hex) % 100000,
            email=f"admin_{uuid.uuid4().hex[:8]}@test.com",
            name="Admin Test",
            role="admin",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


async def _cleanup_user(user_id: int) -> None:
    async with get_main_db() as db:
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()


async def _admin_headers(user: User) -> dict[str, str]:
    token = create_access_token(str(user.id), user.email, user.role)
    return {"Authorization": f"Bearer {token}"}


# ── Feature Flags ───────────────────────────────────────

@pytest.mark.asyncio
async def test_feature_flags_crud(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    # create
    resp = await client.post("/api/feature-flags/admin", json={
        "key": "test-flag-42",
        "enabled": True,
        "description": "A test flag",
        "rollout_percentage": 50.0,
    }, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["flag"]["key"] == "test-flag-42"

    # list
    resp = await client.get("/api/feature-flags/", headers=headers)
    assert resp.status_code == 200
    assert any(f["key"] == "test-flag-42" for f in resp.json()["flags"])

    # get single
    resp = await client.get("/api/feature-flags/test-flag-42", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True

    # update
    resp = await client.put("/api/feature-flags/admin/test-flag-42", json={
        "enabled": False,
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["flag"]["enabled"] is False

    # delete
    resp = await client.delete("/api/feature-flags/admin/test-flag-42", headers=headers)
    assert resp.status_code == 200

    await _cleanup_user(admin.id)


# ── Webhooks ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_webhooks_crud(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    resp = await client.post("/api/webhooks/", json={
        "url": "https://example.com/hook",
        "events": ["sync.complete"],
        "secret": "shh",
    }, headers=headers)
    assert resp.status_code == 200
    hook_id = resp.json()["webhook"]["id"]

    resp = await client.get("/api/webhooks/", headers=headers)
    assert resp.status_code == 200
    assert any(h["id"] == hook_id for h in resp.json()["webhooks"])

    resp = await client.put(f"/api/webhooks/{hook_id}", json={"url": "https://example.com/hook2"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["webhook"]["url"] == "https://example.com/hook2"

    resp = await client.delete(f"/api/webhooks/{hook_id}", headers=headers)
    assert resp.status_code == 200

    await _cleanup_user(admin.id)


# ── Crosstest Comments ──────────────────────────────────

@pytest.mark.asyncio
async def test_crosstest_comments_crud(client: AsyncClient) -> None:
    import random
    admin = await _make_admin()
    headers = await _admin_headers(admin)
    issue_iid = random.randint(10000, 99999)

    # create
    resp = await client.post("/api/crosstest/comments", json={
        "issue_iid": issue_iid,
        "gitlab_project_id": 63,
        "comment": "Initial comment",
    }, headers=headers)
    assert resp.status_code == 200
    comment_id = resp.json()["data"]["id"]

    # list
    resp = await client.get(f"/api/crosstest/comments?issue_iid={issue_iid}", headers=headers)
    assert resp.status_code == 200
    assert str(comment_id) in resp.json()["data"] or any(c["id"] == comment_id for c in resp.json()["data"].values())

    # update
    resp = await client.put(f"/api/crosstest/comments/{comment_id}", json={
        "comment": "Updated comment",
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["comment"] == "Updated comment"

    # delete
    resp = await client.delete(f"/api/crosstest/comments/{comment_id}", headers=headers)
    assert resp.status_code == 200

    await _cleanup_user(admin.id)


# ── Audit Logs ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_audit_logs_list(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    async with get_main_db() as db:
        log = AuditLog(action="test.action", actor_id=admin.id, success=True)
        db.add(log)
        await db.commit()

    resp = await client.get("/api/audit/?page=1&page_size=10", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert data["total"] >= 1

    await _cleanup_user(admin.id)


# ── Notifications ───────────────────────────────────────

@pytest.mark.asyncio
async def test_notification_settings(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    resp = await client.put("/api/notifications/settings", json={
        "project_id": None,
        "email": "alert@test.com",
        "enabled_sla_email": True,
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["setting"]["email"] == "alert@test.com"

    resp = await client.get("/api/notifications/settings", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["settings"]["email"] == "alert@test.com"

    await _cleanup_user(admin.id)


# ── Dashboard ───────────────────────────────────────────

from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_dashboard_multi_and_compare(client: AsyncClient) -> None:
    with patch("app.routers.dashboard.testmo_service.compare_projects", new_callable=AsyncMock) as mock_cmp:
        mock_cmp.return_value = [{"project_id": 1, "pass_rate": 95.0}]
        resp = await client.get("/api/dashboard/multi?project_ids=1&project_ids=2")
        assert resp.status_code == 200
        data = resp.json()
        assert "metrics" in data

        resp = await client.get("/api/dashboard/compare?project_ids=1")
        assert resp.status_code == 200
        assert "projects" in resp.json()


@pytest.mark.asyncio
async def test_dashboard_stream_unit() -> None:
    from unittest.mock import AsyncMock
    from app.routers.dashboard import stream_dashboard
    from fastapi.responses import StreamingResponse

    mock_request = AsyncMock()
    mock_request.is_disconnected.return_value = True
    with patch("app.routers.dashboard.testmo_service.get_project_metrics", new_callable=AsyncMock) as mock_m:
        mock_m.return_value = {"project_id": 1, "pass_rate": 95.0}
        resp = await stream_dashboard(mock_request, project_id=1)
        assert isinstance(resp, StreamingResponse)
        assert resp.media_type == "text/event-stream"


# ── Sync ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_auto_config(client: AsyncClient) -> None:
    resp = await client.get("/api/sync/auto-config")
    assert resp.status_code == 200
    assert "data" in resp.json()


@pytest.mark.asyncio
async def test_sync_history_list(client: AsyncClient) -> None:
    resp = await client.get("/api/sync/history")
    assert resp.status_code == 200
    assert isinstance(resp.json()["data"], list)


# ── Metrics ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_custom_metrics(client: AsyncClient) -> None:
    with patch("app.routers.metrics.testmo_service.health_check", new_callable=AsyncMock) as mock_h:
        mock_h.return_value = True
        resp = await client.get("/api/metrics/")
        assert resp.status_code == 200
        data = resp.json()
        assert "metrics" in data
        assert "users_total" in data["metrics"]


# ── Cache ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cache_clear_admin_token(client: AsyncClient) -> None:
    from app.config import settings
    resp = await client.post("/api/cache/clear", headers={"X-Admin-Token": settings.admin_api_token})
    assert resp.status_code == 200
    assert resp.json()["status"] == "cleared"
