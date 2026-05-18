"""Testmo API client — HTTP layer with cache, dedup & circuit breaker."""

from __future__ import annotations

import asyncio
from typing import Any, Callable, cast

import httpx
from cachetools import TTLCache

from app.config import settings
from app.constants import PaginatedList
from app.core.circuit_breaker import CircuitBreaker
from app.core.resilience import with_resilience
from app.utils.logger import get_logger

logger = get_logger(__name__)


class TestmoClient:
    __test__ = False  # Not a pytest test class

    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=f"{settings.testmo_url.rstrip('/')}/api/v1",
            headers={"Authorization": f"Bearer {settings.testmo_token}"},
            timeout=settings.api_timeout,
        )
        self.cache: TTLCache = TTLCache(maxsize=500, ttl=settings.cache_duration)
        self._in_flight: dict[str, asyncio.Future[Any]] = {}
        self.cb = CircuitBreaker(name="testmo", failure_threshold=5, recovery_timeout=30.0)

    def _cache_key(self, method: str, *parts: Any) -> str:
        return f"{method}:{':'.join(str(p) for p in parts)}"

    async def _cached_request(self, key: str, fetch: Callable[[], Any]) -> Any:
        """Request deduplication + TTL cache."""
        if key in self.cache:
            return self.cache[key]
        if key in self._in_flight:
            return await self._in_flight[key]
        loop = asyncio.get_event_loop()
        fut: asyncio.Future[Any] = loop.create_future()
        self._in_flight[key] = fut
        try:
            data = await fetch()
            self.cache[key] = data
            fut.set_result(data)
            return data
        except Exception as exc:
            fut.set_exception(exc)
            raise
        finally:
            self._in_flight.pop(key, None)

    @with_resilience(breaker=None, max_attempts=3, base_delay_ms=500)
    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        async with self.cb:
            resp = await self.client.get(path, params=params)
            resp.raise_for_status()
            return resp.json()

    @with_resilience(breaker=None, max_attempts=3, base_delay_ms=500)
    async def _post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        async with self.cb:
            resp = await self.client.post(path, json=json)
            resp.raise_for_status()
            if resp.status_code == 204:
                return {}
            return resp.json() if resp.text else {}

    @with_resilience(breaker=None, max_attempts=3, base_delay_ms=500)
    async def _patch(self, path: str, json: dict[str, Any] | None = None) -> Any:
        async with self.cb:
            resp = await self.client.patch(path, json=json)
            resp.raise_for_status()
            if resp.status_code == 204:
                return {}
            return resp.json() if resp.text else {}

    @with_resilience(breaker=None, max_attempts=3, base_delay_ms=500)
    async def _post_multipart(self, path: str, files: dict[str, Any]) -> Any:
        async with self.cb:
            resp = await self.client.post(path, files=files)
            resp.raise_for_status()
            return resp.json() if resp.text else {}

    # ------------------------------------------------------------------
    # Attachments
    # ------------------------------------------------------------------

    async def upload_attachment(
        self,
        case_id: int,
        file_bytes: bytes,
        filename: str,
        mime_type: str = "application/octet-stream",
    ) -> dict[str, Any]:
        """Upload a single file attachment to a Testmo case."""
        return await self._post_multipart(
            f"/cases/{case_id}/attachments/single",
            files={"file": (filename, file_bytes, mime_type)},
        )

    # ------------------------------------------------------------------
    # Projects & runs (read)
    # ------------------------------------------------------------------

    async def get_projects(self) -> list[dict[str, Any]]:
        key = self._cache_key("projects")

        async def _fetch() -> Any:
            data = await self._get("/projects", {"per_page": 100})
            return data if isinstance(data, list) else data.get("result", [])

        result: list[dict[str, Any]] = await self._cached_request(key, _fetch)
        return result

    async def get_project_runs(
        self, project_id: int, active_only: bool = False
    ) -> list[dict[str, Any]]:
        key = self._cache_key("runs", project_id, "active" if active_only else "all")

        async def _fetch() -> Any:
            params: dict[str, Any] = {"per_page": 100}
            if active_only:
                params["is_closed"] = "0"
            data = await self._get(f"/projects/{project_id}/runs", params)
            return data if isinstance(data, list) else data.get("result", [])

        result: list[dict[str, Any]] = await self._cached_request(key, _fetch)
        return result

    async def get_project_sessions(
        self, project_id: int, active_only: bool = False
    ) -> list[dict[str, Any]]:
        key = self._cache_key("sessions", project_id, "active" if active_only else "all")

        async def _fetch() -> Any:
            params: dict[str, Any] = {"per_page": 100}
            if active_only:
                params["is_closed"] = "0"
            data = await self._get(f"/projects/{project_id}/sessions", params)
            return data if isinstance(data, list) else data.get("result", [])

        result: list[dict[str, Any]] = await self._cached_request(key, _fetch)
        return result

    async def get_project_milestones(self, project_id: int) -> list[dict[str, Any]]:
        key = self._cache_key("milestones", project_id)

        async def _fetch() -> Any:
            data = await self._get(f"/projects/{project_id}/milestones", {"per_page": 100})
            return data if isinstance(data, list) else data.get("result", [])

        result: list[dict[str, Any]] = await self._cached_request(key, _fetch)
        return result

    async def get_automation_runs(self, project_id: int) -> dict[str, Any]:
        key = self._cache_key("automation", project_id)

        async def _fetch() -> Any:
            return await self._get(f"/projects/{project_id}/automation/runs", {"per_page": 100})

        result: dict[str, Any] = await self._cached_request(key, _fetch)
        return result

    async def get_run_details(self, run_id: int) -> dict[str, Any]:
        key = self._cache_key("run", run_id)
        result: dict[str, Any] = await self._cached_request(
            key, lambda: self._get(f"/runs/{run_id}")
        )
        return result

    async def get_automation_run_details(self, run_id: int) -> dict[str, Any]:
        key = self._cache_key("automation_run", run_id)
        result: dict[str, Any] = await self._cached_request(
            key, lambda: self._get(f"/automation/runs/{run_id}")
        )
        return result

    async def get_run_results_paginated(self, run_id: int) -> PaginatedList:
        """Paginate through /runs/{run_id}/results and return only is_latest items."""
        all_results: list[dict[str, Any]] = []
        page = 1
        max_pages = settings.max_pages
        while True:
            data = cast(dict[str, Any], await self._get(f"/runs/{run_id}/results", {"page": page}))
            batch = data.get("result", []) if isinstance(data, dict) else data
            if not batch:
                break
            all_results.extend(batch)
            next_page = data.get("next_page") if isinstance(data, dict) else None
            if not next_page:
                break
            page = next_page
            if page > max_pages:
                logger.warning("Pagination limit reached for run %s results", run_id)
                break
        result = PaginatedList([r for r in all_results if r.get("is_latest") is True])
        result.truncated = page > max_pages
        return result

    async def get_case_names(self, project_id: int, needed_ids: list[int]) -> dict[int, str]:
        """Resolve case names by paginating /projects/{project_id}/cases."""
        names: dict[int, str] = {}
        remaining = set(needed_ids)
        page = 1
        while remaining:
            data = cast(
                dict[str, Any], await self._get(f"/projects/{project_id}/cases", {"page": page})
            )
            batch = data.get("result", []) if isinstance(data, dict) else data
            pages = data.get("last_page", 1) if isinstance(data, dict) else 1
            for case in batch:
                if case.get("id") in remaining:
                    names[case["id"]] = case.get("name", "")
                    remaining.discard(case["id"])
            if page >= pages or not remaining:
                break
            page += 1
        if remaining:
            logger.warning(
                "[StatusSync] %s case_id(s) introuvable(s): %s",
                len(remaining),
                ", ".join(str(x) for x in remaining),
            )
        return names

    async def get_run_results(
        self, run_id: int, status_filter: str | None = None, expands: str | None = None
    ) -> dict[str, Any]:
        key = self._cache_key("results", run_id, status_filter or "all", expands or "none")
        params = {}
        if status_filter:
            params["status"] = status_filter
        if expands:
            params["expands"] = expands

        async def _fetch() -> Any:
            return await self._get(f"/runs/{run_id}/results", params)

        result: dict[str, Any] = await self._cached_request(key, _fetch)
        return result

    # ------------------------------------------------------------------
    # Automation runs (write)
    # ------------------------------------------------------------------

    async def create_automation_run(
        self,
        project_id: int,
        name: str,
        source: str,
        tags: list[str] | None = None,
        milestone_id: int | None = None,
        fields: list[dict[str, Any]] | None = None,
        links: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": name, "source": source}
        if tags:
            payload["tags"] = tags
        if milestone_id:
            payload["milestone_id"] = milestone_id
        if fields:
            payload["fields"] = fields
        if links:
            payload["links"] = links
        result: dict[str, Any] = await self._post(
            f"/projects/{project_id}/automation/runs", payload
        )
        return result

    async def find_automation_run(
        self,
        project_id: int,
        name: str,
        source: str | None = None,
    ) -> dict[str, Any] | None:
        data = await self.get_automation_runs(project_id)
        runs: list[dict[str, Any]] = data.get("result", []) if isinstance(data, dict) else data
        for run in runs:
            if run.get("name") == name:
                if source is None or run.get("source") == source:
                    return cast(dict[str, Any], run)
        return None

    async def append_to_automation_run(
        self,
        run_id: int,
        fields: list[dict[str, Any]] | None = None,
        links: list[dict[str, Any]] | None = None,
        artifacts: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if fields:
            payload["fields"] = fields
        if links:
            payload["links"] = links
        if artifacts:
            payload["artifacts"] = artifacts
        result: dict[str, Any] = await self._post(f"/automation/runs/{run_id}/append", payload)
        return result

    async def create_automation_thread(
        self,
        run_id: int,
        elapsed_observed: int | None = None,
        artifacts: list[dict[str, Any]] | None = None,
        fields: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if elapsed_observed is not None:
            payload["elapsed_observed"] = elapsed_observed
        if artifacts:
            payload["artifacts"] = artifacts
        if fields:
            payload["fields"] = fields
        result: dict[str, Any] = await self._post(f"/automation/runs/{run_id}/threads", payload)
        return result

    async def append_test_results(
        self,
        thread_id: int,
        tests: list[dict[str, Any]],
        elapsed_observed: int | None = None,
        artifacts: list[dict[str, Any]] | None = None,
        fields: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"tests": tests}
        if elapsed_observed is not None:
            payload["elapsed_observed"] = elapsed_observed
        if artifacts:
            payload["artifacts"] = artifacts
        if fields:
            payload["fields"] = fields
        result: dict[str, Any] = await self._post(
            f"/automation/runs/threads/{thread_id}/append", payload
        )
        return result

    async def complete_automation_run(
        self,
        run_id: int,
        measure_elapsed: bool = True,
    ) -> dict[str, Any]:
        result: dict[str, Any] = await self._post(
            f"/automation/runs/{run_id}/complete",
            {"measure_elapsed": measure_elapsed},
        )
        return result

    # ------------------------------------------------------------------
    # Case repository (read + write)
    # ------------------------------------------------------------------

    async def get_cases(
        self,
        project_id: int,
        folder_id: int | None = None,
        per_page: int = 100,
        expands: str | None = "tags",
    ) -> PaginatedList:
        all_cases: list[dict[str, Any]] = []
        page = 1
        max_pages = settings.max_pages
        while True:
            params: dict[str, Any] = {"per_page": per_page, "page": page}
            if folder_id is not None:
                params["folder_id"] = folder_id
            if expands:
                params["expands"] = expands
            data = cast(dict[str, Any], await self._get(f"/projects/{project_id}/cases", params))
            batch = data.get("result", []) if isinstance(data, dict) else data
            if not batch:
                break
            all_cases.extend(batch)
            next_page = data.get("next_page") if isinstance(data, dict) else None
            if not next_page:
                break
            page += 1
            if page > max_pages:
                logger.warning("Pagination limit reached for project %s cases", project_id)
                break
        result = PaginatedList(all_cases)
        result.truncated = page > max_pages
        return result

    async def find_case_by_name(
        self,
        project_id: int,
        name: str,
        folder_id: int | None = None,
    ) -> dict[str, Any] | None:
        cases = await self.get_cases(project_id, folder_id)
        for case in cases:
            if case.get("name") == name:
                return cast(dict[str, Any], case)
        return None

    async def create_cases(
        self,
        project_id: int,
        cases: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if not cases:
            return []
        data = cast(
            dict[str, Any], await self._post(f"/projects/{project_id}/cases", {"cases": cases})
        )
        result = data.get("result") if isinstance(data, dict) else data
        return result if isinstance(result, list) else [result] if result else []

    async def update_case(
        self,
        project_id: int,
        case_id: int,
        case_data: dict[str, Any],
    ) -> dict[str, Any]:
        payload = {**case_data, "ids": [case_id]}
        return cast(dict[str, Any], await self._patch(f"/projects/{project_id}/cases", payload))

    # ------------------------------------------------------------------
    # Folder repository (read + write)
    # ------------------------------------------------------------------

    async def get_folders(
        self,
        project_id: int,
        parent_id: int | None = None,
        repo_id: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"per_page": 100}
        if parent_id is not None:
            params["parent_id"] = parent_id
        if repo_id is not None:
            params["repo_id"] = repo_id
        data = cast(dict[str, Any], await self._get(f"/projects/{project_id}/folders", params))
        result: list[dict[str, Any]] = data.get("result", []) if isinstance(data, dict) else data
        return result

    async def create_folder(
        self,
        project_id: int,
        name: str,
        parent_id: int | None = None,
        repo_id: int | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"folders": [{"name": name}]}
        if parent_id is not None:
            payload["folders"][0]["parent_id"] = parent_id
        data = cast(dict[str, Any], await self._post(f"/projects/{project_id}/folders", payload))
        result = data.get("result") if isinstance(data, dict) else data
        created = cast(dict[str, Any], result[0] if isinstance(result, list) and result else data)
        logger.info(
            "Testmo: Folder créé — %r (id=%s, parent=%s)", name, created.get("id"), parent_id
        )
        return created

    async def get_or_create_folder(
        self,
        project_id: int,
        name: str,
        parent_id: int | None = None,
        repo_id: int | None = None,
    ) -> dict[str, Any]:
        existing = await self._find_folder_by_name(project_id, name, parent_id, repo_id)
        if existing:
            logger.info("Testmo: Folder existant — %r (id=%s)", name, existing.get("id"))
            return existing
        return await self.create_folder(project_id, name, parent_id, repo_id)

    async def _find_folder_by_name(
        self,
        project_id: int,
        name: str,
        parent_id: int | None = None,
        repo_id: int | None = None,
    ) -> dict[str, Any] | None:
        folders = await self.get_folders(project_id, parent_id, repo_id)
        for folder in folders:
            if folder.get("name") == name:
                return cast(dict[str, Any], folder)
        return None

    # ------------------------------------------------------------------
    # Health & lifecycle
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        try:
            await self._get("/projects", {"limit": 1})
            return True
        except Exception:
            return False

    async def close(self) -> None:
        await self.client.aclose()

    def clear_cache(self) -> None:
        self.cache.clear()
        logger.info("Testmo cache cleared")
