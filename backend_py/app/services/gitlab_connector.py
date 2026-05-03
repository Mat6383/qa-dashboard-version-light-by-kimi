"""GitLab connector for administrable integrations."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.circuit_breaker import CircuitBreaker
from app.core.resilience import with_resilience
from app.utils.logger import get_logger

logger = get_logger(__name__)

_connector_breaker = CircuitBreaker(
    name="gitlab_connector", failure_threshold=5, recovery_timeout=30.0
)


class GitLabConnector:
    """Lightweight GitLab REST client backed by a connector config."""

    __test__ = False

    def __init__(self, base_url: str, token: str, verify_ssl: bool = True) -> None:
        base = base_url.rstrip("/")
        self.client = httpx.AsyncClient(
            base_url=f"{base}/api/v4",
            headers={"PRIVATE-TOKEN": token},
            timeout=30.0,
            verify=verify_ssl,
        )

    @with_resilience(breaker=_connector_breaker, max_attempts=3, base_delay_ms=600)
    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        resp = await self.client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    async def test_connection(
        self, project_id: str | int | None = None
    ) -> dict[str, Any]:
        try:
            url = f"/projects/{project_id}" if project_id else "/projects"
            params = {} if project_id else {"per_page": 1}
            await self._get(url, params)
            return {"success": True, "message": "Connexion GitLab réussie"}
        except Exception as exc:
            logger.error("GitLab connector test failed: %s", exc)
            return {"success": False, "message": str(exc)}

    async def list_projects(self) -> list[dict[str, Any]]:
        data = await self._get("/projects", {"membership": "true", "per_page": 100})
        return [
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "path_with_namespace": p.get("path_with_namespace"),
            }
            for p in data
        ]

    async def list_issues(
        self,
        project_id: str | int,
        state: str = "all",
        labels: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"state": state, "scope": "all", "per_page": 100}
        if labels:
            params["label_name[]"] = labels
        return await self._get(f"/projects/{project_id}/issues", params)

    async def list_merge_requests(
        self, project_id: str | int, state: str = "opened"
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"state": state, "per_page": 100}
        return await self._get(f"/projects/{project_id}/merge_requests", params)


class GitLabConnectorService:
    """High-level connector operations backed by integration configs."""

    async def test_connection(self, config: dict[str, Any]) -> dict[str, Any]:
        url = config.get("url") or config.get("baseUrl", "")
        token = config.get("token", "")
        project_id = config.get("projectId") or config.get("project_id")
        verify = config.get("verifySsl", True)
        if not url or not token:
            return {"success": False, "message": "URL et token requis"}
        connector = GitLabConnector(url, token, verify)
        return await connector.test_connection(project_id)

    async def list_projects(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        connector = GitLabConnector(
            config.get("url") or config.get("baseUrl", ""),
            config.get("token", ""),
            config.get("verifySsl", True),
        )
        return await connector.list_projects()

    async def list_issues(
        self, config: dict[str, Any], project_id: str | int
    ) -> list[dict[str, Any]]:
        connector = GitLabConnector(
            config.get("url") or config.get("baseUrl", ""),
            config.get("token", ""),
            config.get("verifySsl", True),
        )
        return await connector.list_issues(project_id)


gitlab_connector_service = GitLabConnectorService()
