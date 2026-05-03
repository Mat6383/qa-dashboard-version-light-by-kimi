"""Phase 4 endpoint tests — tRPC bridge, analytics, retention, integrations, webhooks, alerting."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from app.core.security import create_access_token
from app.database import get_main_db
from app.models.analytics import AnalyticsInsight
from app.models.integrations import Integration
from app.models.notifications import NotificationSetting
from app.models.retention import ArchivedSnapshot, RetentionPolicy
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


# ── tRPC Bridge ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_trpc_analytics_list(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    # Seed an insight
    async with get_main_db() as db:
        db.add(AnalyticsInsight(project_id=1, type="test", title="T", message="M", confidence=0.9))
        await db.commit()

    resp = await client.post("/trpc/", json=[
        {"path": "analytics.list", "method": "query", "input": {"projectId": 1, "limit": 10}, "id": 1}
    ], headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert data[0]["id"] == 1
    assert isinstance(data[0]["result"]["data"], list)

    await _cleanup_user(admin.id)


@pytest.mark.asyncio
async def test_trpc_analytics_mark_read(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    async with get_main_db() as db:
        ins = AnalyticsInsight(project_id=1, type="test", title="T", message="M", confidence=0.9)
        db.add(ins)
        await db.commit()
        await db.refresh(ins)
        insight_id = ins.id

    resp = await client.post("/trpc/", json=[
        {"path": "analytics.markRead", "method": "mutation", "input": {"id": insight_id}, "id": 2}
    ], headers=headers)
    assert resp.status_code == 200
    assert resp.json()[0]["result"]["data"]["success"] is True

    await _cleanup_user(admin.id)


@pytest.mark.asyncio
async def test_trpc_retention_policies(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    resp = await client.post("/trpc/", json=[
        {"path": "retention.policies", "method": "query", "input": {}, "id": 3}
    ], headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json()[0]["result"]["data"], list)

    await _cleanup_user(admin.id)


@pytest.mark.asyncio
async def test_trpc_integrations_crud(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    # create
    resp = await client.post("/trpc/", json=[
        {"path": "integrations.create", "method": "mutation", "input": {"name": "Jira", "type": "jira", "config": {}}, "id": 4}
    ], headers=headers)
    assert resp.status_code == 200
    integration_id = resp.json()[0]["result"]["data"]["id"]

    # list
    resp = await client.post("/trpc/", json=[
        {"path": "integrations.list", "method": "query", "input": {}, "id": 5}
    ], headers=headers)
    assert resp.status_code == 200
    assert any(i["id"] == integration_id for i in resp.json()[0]["result"]["data"])

    # delete
    resp = await client.post("/trpc/", json=[
        {"path": "integrations.delete", "method": "mutation", "input": {"id": integration_id}, "id": 6}
    ], headers=headers)
    assert resp.status_code == 200

    await _cleanup_user(admin.id)


@pytest.mark.asyncio
async def test_trpc_webhooks_crud(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    resp = await client.post("/trpc/", json=[
        {"path": "webhooks.create", "method": "mutation", "input": {"url": "https://ex.com/hook", "events": ["test"], "secret": "shh"}, "id": 7}
    ], headers=headers)
    assert resp.status_code == 200
    hook_id = resp.json()[0]["result"]["data"]["data"]["id"]

    resp = await client.post("/trpc/", json=[
        {"path": "webhooks.delete", "method": "mutation", "input": {"id": hook_id}, "id": 8}
    ], headers=headers)
    assert resp.status_code == 200

    await _cleanup_user(admin.id)


# ── Analytics REST ──────────────────────────────────────

@pytest.mark.asyncio
async def test_analytics_rest_list(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    async with get_main_db() as db:
        db.add(AnalyticsInsight(project_id=2, type="rest", title="R", message="M", confidence=0.8))
        await db.commit()

    resp = await client.get("/api/analytics/?project_id=2&limit=10", headers=headers)
    assert resp.status_code == 200
    assert any(i["type"] == "rest" for i in resp.json()["insights"])

    await _cleanup_user(admin.id)


@pytest.mark.asyncio
async def test_analytics_rest_analyze(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    with patch("app.services.analytics.analytics_service.analyze_project", new_callable=AsyncMock) as mock_a:
        mock_a.return_value = {"project_id": 1, "insights_created": 2}
        resp = await client.post("/api/analytics/analyze", json={"project_id": 1}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["insights_created"] == 2

    await _cleanup_user(admin.id)


# ── Retention REST ──────────────────────────────────────

@pytest.mark.asyncio
async def test_retention_policies_rest(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    resp = await client.get("/api/retention/policies", headers=headers)
    assert resp.status_code == 200
    assert "policies" in resp.json()

    await _cleanup_user(admin.id)


@pytest.mark.asyncio
async def test_retention_run_cycle_rest(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    with patch("app.services.retention.retention_service.run_retention_cycle", new_callable=AsyncMock) as mock_r:
        mock_r.return_value = {"archived": 5, "deleted": 2}
        resp = await client.post("/api/retention/run-cycle", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["archived"] == 5

    await _cleanup_user(admin.id)


# ── Integrations REST ───────────────────────────────────

@pytest.mark.asyncio
async def test_integrations_rest_crud(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    resp = await client.post("/api/integrations/", json={
        "name": "MyJira", "type": "jira", "config": {"base_url": "https://jira.example.com"}
    }, headers=headers)
    assert resp.status_code == 200
    integration_id = resp.json()["integration"]["id"]

    resp = await client.get(f"/api/integrations/{integration_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["integration"]["name"] == "MyJira"

    resp = await client.delete(f"/api/integrations/{integration_id}", headers=headers)
    assert resp.status_code == 200

    await _cleanup_user(admin.id)


@pytest.mark.asyncio
async def test_integrations_test_jira_mock(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    resp = await client.post("/api/integrations/", json={
        "name": "JiraTest", "type": "jira", "config": {"base_url": "http://test", "email": "a@b.com", "api_token": "tok"}
    }, headers=headers)
    integration_id = resp.json()["integration"]["id"]

    with patch("app.services.jira.JiraClient.test_connection", new_callable=AsyncMock) as mock_t:
        mock_t.return_value = {"success": True, "account_id": "123"}
        resp = await client.post(f"/api/integrations/{integration_id}/test", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    await _cleanup_user(admin.id)


# ── Webhooks outgoing ───────────────────────────────────

@pytest.mark.asyncio
async def test_webhook_emitter_mock(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    async with get_main_db() as db:
        sub = WebhookSubscription(url="https://hook.example.com/e", events=["feature-flag.changed"], secret="secret")
        db.add(sub)
        await db.commit()

    from app.services.webhook_emitter import webhook_emitter

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.raise_for_status = lambda: None
        async with get_main_db() as db:
            result = await webhook_emitter.emit(db, "feature-flag.changed", {"flag": "dark_mode"})
        assert any(r["status"]["success"] for r in result)

    await _cleanup_user(admin.id)


# ── Alerting active ─────────────────────────────────────

@pytest.mark.asyncio
async def test_alerting_email_not_configured(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    resp = await client.post("/api/notifications/test", json={
        "channel": "email", "destination": "test@example.com"
    }, headers=headers)
    # SMTP not configured → should return 400 with error
    assert resp.status_code == 400

    await _cleanup_user(admin.id)


@pytest.mark.asyncio
async def test_alerting_slack_mock(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    from app.services.alerting import alerting_service

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.raise_for_status = lambda: None
        result = await alerting_service.send_slack("https://hooks.slack.com/test", "Hello")
        assert result["success"] is True

    await _cleanup_user(admin.id)


@pytest.mark.asyncio
async def test_alerting_teams_mock(client: AsyncClient) -> None:
    admin = await _make_admin()
    headers = await _admin_headers(admin)

    from app.services.alerting import alerting_service

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.raise_for_status = lambda: None
        result = await alerting_service.send_teams("https://webhook.office.com/test", "Hello")
        assert result["success"] is True

    await _cleanup_user(admin.id)
