"""GitLab REST + GraphQL client with pagination, retry & circuit breaker."""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings
from app.core.circuit_breaker import CircuitBreaker
from app.core.resilience import with_resilience
from app.utils.logger import get_logger

logger = get_logger(__name__)


class GitLabService:
    __test__ = False  # Not a pytest test class
    def __init__(self) -> None:
        base = settings.gitlab_url.rstrip("/")
        verify = settings.gitlab_verify_ssl

        self.rest = httpx.AsyncClient(
            base_url=f"{base}/api/v4",
            headers={"PRIVATE-TOKEN": settings.gitlab_token},
            timeout=settings.api_timeout,
            verify=verify,
        )
        self.rest_write = httpx.AsyncClient(
            base_url=f"{base}/api/v4",
            headers={"PRIVATE-TOKEN": settings.gitlab_write_token or settings.gitlab_token},
            timeout=settings.api_timeout,
            verify=verify,
        )
        self.graphql = httpx.AsyncClient(
            base_url=base,
            headers={"PRIVATE-TOKEN": settings.gitlab_write_token or settings.gitlab_token},
            timeout=settings.api_timeout,
            verify=verify,
        )

        self.cb_rest = CircuitBreaker(name="gitlab_rest", failure_threshold=5, recovery_timeout=30.0)
        self.cb_graphql = CircuitBreaker(name="gitlab_graphql", failure_threshold=5, recovery_timeout=30.0)

    @with_resilience(breaker=None, max_attempts=3, base_delay_ms=600)
    async def _rest_get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        async with self.cb_rest:
            resp = await self.rest.get(path, params=params)
            resp.raise_for_status()
            return resp.json()

    @with_resilience(breaker=None, max_attempts=3, base_delay_ms=600)
    async def _rest_post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        async with self.cb_rest:
            resp = await self.rest_write.post(path, json=json)
            resp.raise_for_status()
            return resp.json()

    @with_resilience(breaker=None, max_attempts=3, base_delay_ms=600)
    async def _rest_put(self, path: str, json: dict[str, Any] | None = None) -> Any:
        async with self.cb_rest:
            resp = await self.rest_write.put(path, json=json)
            resp.raise_for_status()
            return resp.json()

    @with_resilience(breaker=None, max_attempts=2, base_delay_ms=800)
    async def _graphql(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        async with self.cb_graphql:
            resp = await self.graphql.post(
                "/api/graphql",
                json={"query": query, "variables": variables or {}},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("errors"):
                raise httpx.HTTPStatusError(
                    f"GraphQL errors: {data['errors']}",
                    request=resp.request,
                    response=resp,
                )
            return data["data"]

    async def _get_paginated(self, path: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """Follow x-next-page header, 100 items/page."""
        all_items: list[dict[str, Any]] = []
        page_params = dict(params or {})
        page_params.setdefault("per_page", 100)
        page = 1
        while True:
            page_params["page"] = page
            async with self.cb_rest:
                resp = await self.rest.get(path, params=page_params)
                resp.raise_for_status()
                items = resp.json()
                if not isinstance(items, list):
                    break
                all_items.extend(items)
                next_page = resp.headers.get("x-next-page")
                if not next_page:
                    break
                page = int(next_page)
        return all_items

    async def find_iteration(self, project_id: str | int, title: str) -> dict[str, Any] | None:
        iterations = await self._get_paginated(f"/projects/{project_id}/iterations")
        normalized = title.lower().replace(" ", "-").replace("_", "-")
        for it in iterations:
            it_title = (it.get("title") or "").lower().replace(" ", "-").replace("_", "-")
            if it_title == normalized or normalized in it_title:
                return it
        return None

    async def get_issues_by_label_and_iteration(
        self, project_id: str | int, label: str, iteration_id: str | int
    ) -> list[dict[str, Any]]:
        return await self._get_paginated(
            f"/projects/{project_id}/issues",
            {"label_name[]": label, "iteration_id": iteration_id, "state": "all"},
        )

    async def get_issue_notes(self, project_id: str | int, issue_iid: int) -> list[dict[str, Any]]:
        notes = await self._get_paginated(f"/projects/{project_id}/issues/{issue_iid}/notes")
        return [n for n in notes if not n.get("system")]

    async def add_issue_comment(self, project_id: str | int, issue_iid: int, body: str) -> dict[str, Any]:
        return await self._rest_post(f"/projects/{project_id}/issues/{issue_iid}/notes", {"body": body})

    async def update_issue_label(
        self, project_id: str | int, issue_iid: int, add_labels: list[str], remove_labels: list[str]
    ) -> dict[str, Any]:
        return await self._rest_put(
            f"/projects/{project_id}/issues/{issue_iid}",
            {"add_labels": ",".join(add_labels), "remove_labels": ",".join(remove_labels)},
        )

    async def update_work_item_status(self, work_item_global_id: str, status_global_id: str) -> dict[str, Any]:
        query = """
        mutation($id: WorkItemID!, $statusId: WorkItemStateID!) {
          workItemUpdate(input: {id: $id, stateId: $statusId}) {
            workItem { id title state { name } }
            errors
          }
        }
        """
        data = await self._graphql(query, {"id": work_item_global_id, "statusId": status_global_id})
        return data["workItemUpdate"]["workItem"]

    async def health_check(self) -> bool:
        try:
            await self._rest_get("/user")
            return True
        except Exception:
            return False

    @classmethod
    def from_config(cls, config: dict[str, Any]) -> "GitLabService":
        """Create a GitLabService from an integration config dict."""
        instance = cls.__new__(cls)
        base = (config.get("url") or config.get("baseUrl", "")).rstrip("/")
        verify = config.get("verifySsl", True)
        token = config.get("token", "")
        write_token = config.get("writeToken") or token

        instance.rest = httpx.AsyncClient(
            base_url=f"{base}/api/v4",
            headers={"PRIVATE-TOKEN": token},
            timeout=settings.api_timeout,
            verify=verify,
        )
        instance.rest_write = httpx.AsyncClient(
            base_url=f"{base}/api/v4",
            headers={"PRIVATE-TOKEN": write_token},
            timeout=settings.api_timeout,
            verify=verify,
        )
        instance.graphql = httpx.AsyncClient(
            base_url=base,
            headers={"PRIVATE-TOKEN": write_token},
            timeout=settings.api_timeout,
            verify=verify,
        )
        instance.cb_rest = CircuitBreaker(
            name="gitlab_rest", failure_threshold=5, recovery_timeout=30.0
        )
        instance.cb_graphql = CircuitBreaker(
            name="gitlab_graphql", failure_threshold=5, recovery_timeout=30.0
        )
        return instance

    async def get_current_user(self) -> dict[str, Any]:
        return await self._rest_get("/user")

    async def get_project(self, project_id: str | int) -> dict[str, Any]:
        return await self._rest_get(f"/projects/{project_id}")

    async def get_project_iterations(self, project_id: str | int, search: str | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"state": "all"}
        if search:
            params["search"] = search
        return await self._get_paginated(f"/projects/{project_id}/iterations", params)

    async def get_project_issues(
        self, project_id: str | int, state: str = "all", labels: list[str] | None = None, search: str | None = None
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"state": state}
        if labels:
            params["label_name[]"] = labels
        if search:
            params["search"] = search
        return await self._get_paginated(f"/projects/{project_id}/issues", params)

    async def get_issue(self, project_id: str | int, issue_iid: int) -> dict[str, Any]:
        return await self._rest_get(f"/projects/{project_id}/issues/{issue_iid}")

    async def get_user_by_id(self, user_id: int) -> dict[str, Any] | None:
        try:
            return await self._rest_get(f"/users/{user_id}")
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return None
            raise


gitlab_service = GitLabService()
