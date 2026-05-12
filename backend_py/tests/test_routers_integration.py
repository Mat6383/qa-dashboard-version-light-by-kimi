"""Integration tests for critical FastAPI routers with mocked services."""

from __future__ import annotations

import random
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from app.config import settings
from app.core.security import create_access_token
from app.database import get_main_db
from app.main import app
from app.models.users import User


async def _make_auth_client(role: str = "admin") -> tuple[AsyncClient, str]:
    gitlab_id = 800000 + random.randint(0, 50000)
    async with get_main_db() as db:
        user = User(
            gitlab_id=gitlab_id,
            email=f"rt_{gitlab_id}@example.com",
            name="Router Test",
            role=role,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    token = create_access_token(str(user.id), user.email, user.role)
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"Authorization": f"Bearer {token}"})
    return client, token


@pytest.mark.asyncio
class TestProjectsRouter:
    async def test_list_projects(self, client: AsyncClient) -> None:
        with patch("app.routers.projects.testmo_service.get_projects", new_callable=AsyncMock) as mock:
            mock.return_value = [{"id": 1, "name": "Alpha"}]
            response = await client.get("/api/projects/", follow_redirects=True)
            assert response.status_code == 200
            assert response.json()["projects"][0]["name"] == "Alpha"

    async def test_get_project_runs(self, client: AsyncClient) -> None:
        with patch("app.routers.projects.testmo_service.get_project_runs", new_callable=AsyncMock) as mock:
            mock.return_value = [{"id": 10, "name": "R01"}]
            response = await client.get("/api/projects/1/runs?active=true")
            assert response.status_code == 200
            assert response.json()["runs"][0]["name"] == "R01"

    async def test_get_project_milestones(self, client: AsyncClient) -> None:
        with patch("app.routers.projects.testmo_service.get_project_milestones", new_callable=AsyncMock) as mock:
            mock.return_value = [{"id": 5, "name": "M1"}]
            response = await client.get("/api/projects/1/milestones")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["result"][0]["name"] == "M1"

    async def test_get_project_automation(self, client: AsyncClient) -> None:
        with patch("app.routers.projects.testmo_service.get_automation_runs", new_callable=AsyncMock) as mock:
            mock.return_value = {"result": [{"id": 7, "name": "Auto-1"}]}
            response = await client.get("/api/projects/1/automation")
            assert response.status_code == 200
            assert response.json()["automation"]["result"][0]["name"] == "Auto-1"


@pytest.mark.asyncio
class TestRunsRouter:
    async def test_get_run(self, client: AsyncClient) -> None:
        with patch("app.routers.runs.testmo_service.get_run_details", new_callable=AsyncMock) as mock:
            mock.return_value = {"id": 99, "name": "Run-X"}
            response = await client.get("/api/runs/99")
            assert response.status_code == 200
            assert response.json()["name"] == "Run-X"

    async def test_get_run_results(self, client: AsyncClient) -> None:
        with patch("app.routers.runs.testmo_service.get_run_results", new_callable=AsyncMock) as mock:
            mock.return_value = {"result": [{"id": 1, "status_id": 2}]}
            response = await client.get("/api/runs/99/results?status=passed")
            assert response.status_code == 200
            assert response.json()["results"]["result"][0]["status_id"] == 2


@pytest.mark.asyncio
class TestSyncRouter:
    async def test_sync_projects(self, client: AsyncClient) -> None:
        response = await client.get("/api/sync/projects")
        assert response.status_code == 200
        assert response.json()["success"] is True
        data = response.json()["data"]
        assert len(data) == 5
        assert data[0]["id"] == "neo-pilot"
        assert data[0]["label"] == "Neo-Pilot"
        assert data[0]["configured"] is True
        assert data[-1]["id"] == "kiosk"
        assert data[-1]["configured"] is False

    async def test_sync_iterations(self, client: AsyncClient) -> None:
        with patch("app.routers.sync.sync_service.list_iterations", new_callable=AsyncMock) as mock:
            mock.return_value = [{"id": 1, "title": "R01"}]
            response = await client.get("/api/sync/1/iterations?search=R01")
            assert response.status_code == 200
            assert response.json()["data"][0]["title"] == "R01"

    async def test_sync_history(self, client: AsyncClient) -> None:
        with patch("app.routers.sync.sync_service.get_history", new_callable=AsyncMock) as mock:
            mock.return_value = [{"id": 1, "project_name": "P1"}]
            response = await client.get("/api/sync/history")
            assert response.status_code == 200
            assert response.json()["data"][0]["project_name"] == "P1"

    async def test_sync_auto_config(self, client: AsyncClient) -> None:
        with patch("app.routers.sync.sync_service.get_auto_config", new_callable=AsyncMock) as mock:
            mock.return_value = {"enabled": False, "mode": "automation"}
            response = await client.get("/api/sync/auto-config")
            assert response.status_code == 200
            assert response.json()["data"]["enabled"] is False

    async def test_sync_preview(self, client: AsyncClient) -> None:
        with patch("app.routers.sync.sync_service.preview_sync", new_callable=AsyncMock) as mock:
            mock.return_value = {"iteration": {"name": "R01"}, "summary": {"toCreate": 1}}
            response = await client.post("/api/sync/preview", json={"project_id": 1, "iteration_name": "R01"})
            assert response.status_code == 200
            assert response.json()["data"]["summary"]["toCreate"] == 1

    async def test_sync_cases_history(self, client: AsyncClient) -> None:
        with patch("app.routers.sync.case_sync_service.get_history", new_callable=AsyncMock) as mock:
            mock.return_value = [{"id": 1, "iteration_name": "R01"}]
            response = await client.get("/api/sync/cases/history")
            assert response.status_code == 200
            assert response.json()["data"][0]["iteration_name"] == "R01"

    async def test_test_api_requires_admin_token(self, client: AsyncClient) -> None:
        response = await client.post("/api/sync/test-api")
        assert response.status_code == 403

    async def test_test_api_with_admin_token(self, client: AsyncClient) -> None:
        response = await client.post("/api/sync/test-api", headers={"X-Admin-Token": settings.admin_api_token})
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


@pytest.mark.asyncio
class TestExportRouter:
    async def test_export_csv(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            response = await ac.post("/api/export/csv", json={"rows": [{"a": 1, "b": 2}], "filename": "test.csv"})
            assert response.status_code == 200
            assert response.headers["content-type"] == "text/csv; charset=utf-8"
            assert "test.csv" in response.headers["content-disposition"]

    async def test_export_excel(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            response = await ac.post("/api/export/excel", json={"rows": [{"a": 1, "b": 2}], "filename": "test.xlsx"})
            assert response.status_code == 200
            assert "spreadsheet" in response.headers["content-type"]

    async def test_export_no_auth(self, client: AsyncClient) -> None:
        response = await client.post("/api/export/csv", json={"rows": []})
        assert response.status_code == 401


@pytest.mark.asyncio
class TestPdfRouter:
    async def test_generate_pdf_no_auth(self, client: AsyncClient) -> None:
        response = await client.post("/api/pdf/generate", json={"html": "<h1>Test</h1>"})
        assert response.status_code == 401


@pytest.mark.asyncio
class TestReportsRouter:
    async def test_generate_report_no_auth(self, client: AsyncClient) -> None:
        response = await client.post("/api/reports/generate", json={"run_id": 1, "format": "html"})
        assert response.status_code == 401

    async def test_generate_report_with_auth(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            with patch("app.routers.reports.report_service.generate", new_callable=AsyncMock) as mock:
                mock.return_value = {"html": "<html></html>", "pptx_base64": None}
                response = await ac.post("/api/reports/generate", json={"run_id": 1, "format": "html"})
                assert response.status_code == 200
                assert response.json()["success"] is True
                assert response.json()["data"]["html"] == "<html></html>"


@pytest.mark.asyncio
class TestTestmoBrowserRouter:
    async def test_health_requires_admin(self, client: AsyncClient) -> None:
        response = await client.get("/api/testmo-browser/health")
        assert response.status_code == 401

    async def test_health_with_admin_ok(self) -> None:
        ac, _ = await _make_auth_client("admin")
        async with ac:
            with patch("app.routers.testmo_browser.testmo_browser_service.health_check", new_callable=AsyncMock) as mock:
                mock.return_value = {"ok": True, "message": "OK"}
                response = await ac.get("/api/testmo-browser/health")
                assert response.status_code == 200
                assert response.json()["success"] is True

    async def test_create_run_requires_admin(self, client: AsyncClient) -> None:
        response = await client.post("/api/testmo-browser/runs", json={"projectId": 1, "name": "Test"})
        assert response.status_code == 401

    async def test_add_results_requires_admin(self, client: AsyncClient) -> None:
        response = await client.post("/api/testmo-browser/runs/1/results", json={"projectId": 1, "results": []})
        assert response.status_code == 401


@pytest.mark.asyncio
class TestFeatureFlagsRouter:
    async def test_list_feature_flags(self, client: AsyncClient) -> None:
        response = await client.get("/api/feature-flags", follow_redirects=True)
        assert response.status_code == 200
        assert "data" in response.json()


@pytest.mark.asyncio
class TestHealthRouter:
    async def test_health_endpoint(self, client: AsyncClient) -> None:
        response = await client.get("/api/health", follow_redirects=True)
        assert response.status_code == 200

    async def test_readiness_endpoint(self, client: AsyncClient) -> None:
        response = await client.get("/api/health/ready")
        assert response.status_code == 200

    async def test_detailed_health_endpoint(self, client: AsyncClient) -> None:
        response = await client.get("/api/health/detailed", follow_redirects=True)
        assert response.status_code == 200
        json = response.json()
        assert "gitlab" in json or "services" in json or "status" in json


@pytest.mark.asyncio
class TestDashboardRouter:
    async def test_dashboard_metrics(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            with patch("app.routers.dashboard.testmo_service.get_project_metrics", new_callable=AsyncMock) as mock:
                mock.return_value = {"passRate": 95.0, "completionRate": 80.0}
                response = await ac.get("/api/dashboard/1")
                assert response.status_code == 200
                assert response.json()["passRate"] == 95.0

    async def test_dashboard_trends(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            with patch("app.routers.dashboard.testmo_service.get_annual_quality_trends", new_callable=AsyncMock) as mock:
                mock.return_value = [{"version": "2024", "passRate": 90.0}]
                response = await ac.get("/api/dashboard/1/annual-trends")
                assert response.status_code == 200
                assert response.json()["data"][0]["version"] == "2024"

    async def test_dashboard_compare(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            with patch("app.routers.dashboard.testmo_service.compare_projects", new_callable=AsyncMock) as mock:
                mock.return_value = [{"project_id": 1, "passRate": 90.0}]
                response = await ac.get("/api/dashboard/compare?project_ids=1&project_ids=2")
                assert response.status_code == 200
                assert response.json()["projects"][0]["project_id"] == 1

    async def test_dashboard_multi(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            with patch("app.routers.dashboard.testmo_service.compare_projects", new_callable=AsyncMock) as mock:
                mock.return_value = [{"passRate": 90.0}]
                response = await ac.get("/api/dashboard/multi?project_ids=1&project_ids=2")
                assert response.status_code == 200
                assert response.json()["metrics"][0]["passRate"] == 90.0


@pytest.mark.asyncio
class TestCacheRouter:
    async def test_clear_cache_no_auth(self, client: AsyncClient) -> None:
        response = await client.post("/api/cache/clear")
        assert response.status_code == 403

    async def test_clear_cache_admin(self, client: AsyncClient) -> None:
        response = await client.post("/api/cache/clear", headers={"X-Admin-Token": settings.admin_api_token})
        assert response.status_code == 200
        assert response.json()["status"] == "cleared"


@pytest.mark.asyncio
class TestDocsRouter:
    async def test_list_docs(self, client: AsyncClient) -> None:
        response = await client.get("/api/docs", follow_redirects=True)
        assert response.status_code == 200
        assert "message" in response.json() or isinstance(response.json(), list)


@pytest.mark.asyncio
class TestMetricsRouter:
    async def test_metrics_endpoint(self, client: AsyncClient) -> None:
        response = await client.get("/api/metrics", follow_redirects=True)
        assert response.status_code == 200
        assert "metrics" in response.json()


@pytest.mark.asyncio
class TestTrpcRouter:
    async def test_trpc_unknown_procedure_returns_not_found(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            response = await ac.post("/trpc/", json={"path": "unknown.foo", "id": 1})
            assert response.status_code == 200
            body = response.json()
            assert isinstance(body, list)
            assert body[0]["error"]["code"] == "NOT_FOUND"

    async def test_trpc_dashboard_metrics(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            with patch("app.routers.trpc.dashboard.testmo_service.get_project_metrics", new_callable=AsyncMock) as mock:
                mock.return_value = {"pass_rate": 75.0, "total": 4, "passed": 3, "failed": 1}
                response = await ac.post(
                    "/trpc/",
                    json={"path": "dashboard.metrics", "input": {"projectId": 1}, "id": 42},
                )
                assert response.status_code == 200
                body = response.json()
                assert body[0]["id"] == 42
                assert body[0]["result"]["data"]["data"]["pass_rate"] == 75.0

    async def test_trpc_batch_get_dashboard(self) -> None:
        ac, _ = await _make_auth_client("viewer")
        async with ac:
            with patch("app.routers.trpc.dashboard.testmo_service.get_project_metrics", new_callable=AsyncMock) as mock:
                mock.return_value = {"pass_rate": 88.0}
                response = await ac.get("/trpc/dashboard.metrics?input=%7B%22projectId%22%3A1%7D")
                assert response.status_code == 200
                body = response.json()
                assert body[0]["result"]["data"]["data"]["pass_rate"] == 88.0
