"""GitLab REST + GraphQL client with pagination, retry & circuit breaker."""

from __future__ import annotations

import re
from typing import Any

import httpx

from app.config import settings
from app.constants import PaginatedList
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
            headers={"PRIVATE-TOKEN": settings.gitlab_write_token or settings.gitlab_token},
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
        self._project_path_cache: dict[str | int, str] = {}

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

    async def _get_paginated(self, path: str, params: dict[str, Any] | None = None) -> PaginatedList:
        """Follow x-next-page header, 100 items/page. Deduplicate by id."""
        seen_ids: set[int | str] = set()
        all_items: list[dict[str, Any]] = []
        page_params = dict(params or {})
        page_params.setdefault("per_page", 100)
        page = 1
        max_pages = settings.max_pages
        while True:
            page_params["page"] = page
            async with self.cb_rest:
                resp = await self.rest.get(path, params=page_params)
                resp.raise_for_status()
                items = resp.json()
                if not isinstance(items, list):
                    break
                for item in items:
                    item_id = item.get("id")
                    if item_id not in seen_ids:
                        seen_ids.add(item_id)
                        all_items.append(item)
                next_page = resp.headers.get("x-next-page")
                if not next_page:
                    break
                page = int(next_page)
                if page > max_pages:
                    logger.warning("Pagination limit reached for %s", path)
                    break
        result = PaginatedList(all_items)
        result.truncated = page > max_pages
        return result

    async def close(self) -> None:
        await self.rest.aclose()
        await self.rest_write.aclose()
        await self.graphql.aclose()

    def _format_iteration_date(self, d: str | None) -> str:
        if not d:
            return "?"
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
            return dt.strftime("%d/%m")
        except ValueError:
            return "?"

    def _iteration_fallback_title(self, it: dict[str, Any]) -> str:
        """Generate a display title for GitLab auto-cadence iterations (title=null)."""
        iid = it.get("iid") or it.get("sequence") or it.get("id")
        return f"Itération #{iid} ({self._format_iteration_date(it.get('start_date'))} → {self._format_iteration_date(it.get('due_date'))})"

    async def find_iteration_for_project(self, project_id: str | int, iteration_name: str) -> dict[str, Any] | None:
        """Find iteration by iid (generated iterations) or normalized title (including fallback titles)."""
        iterations = await self._get_paginated(f"/projects/{project_id}/iterations", {"state": "all"})
        generated_match = re.search(r"#(\d+)", iteration_name)
        if generated_match and re.search(r"it.ration", iteration_name, re.IGNORECASE):
            target_iid = int(generated_match.group(1))
            for it in iterations:
                if it.get("iid") == target_iid:
                    logger.info("GitLab: Itération trouvée par iid=%s (project %s, id=%s)", target_iid, project_id, it.get("id"))
                    return it
        def normalize(s: str) -> str:
            return re.sub(r"[-\s]+", "", s.lower())
        normalized_search = normalize(iteration_name)
        for it in iterations:
            it_title = it.get("title") or self._iteration_fallback_title(it)
            if normalize(it_title) == normalized_search:
                logger.info('GitLab: Itération trouvée (project %s) - "%s" (id=%s)', project_id, it_title, it.get("id"))
                return it
        logger.warn('GitLab: Itération "%s" non trouvée dans project %s', iteration_name, project_id)
        return None

    def _filtered(self, source: PaginatedList, items: list[dict[str, Any]]) -> PaginatedList:
        result = PaginatedList(items)
        result.truncated = getattr(source, "truncated", False)
        return result

    async def get_issues_for_iteration(
        self, project_id: str | int, iteration_id: str | int, state: str = "all"
    ) -> PaginatedList:
        return await self._get_paginated(
            f"/projects/{project_id}/issues",
            {"iteration_id": iteration_id, "state": state, "scope": "all"},
        )

    async def get_issues_by_version_and_iteration(
        self, project_id: str | int, version: str, iteration_id: str | int
    ) -> PaginatedList:
        all_issues = await self.get_issues_for_iteration(project_id, iteration_id)
        if not all_issues:
            return []
        ids = [f"gid://gitlab/WorkItem/{issue['id']}" for issue in all_issues]
        query = """
        query GetVersions($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on WorkItem {
              id
              widgets {
                ... on WorkItemWidgetCustomFields {
                  customFieldValues {
                    customField { id name }
                    ... on WorkItemSelectFieldValue { selectedOptions { value } }
                  }
                }
              }
            }
          }
        }
        """
        data = await self._graphql(query, {"ids": ids})
        version_by_gid: dict[str, str | None] = {}
        for node in data.get("nodes", []):
            cf_widget = next(
                (w for w in node.get("widgets", []) if isinstance(w.get("customFieldValues"), list)), None
            )
            version_prod = None
            if cf_widget:
                for cf in cf_widget.get("customFieldValues", []):
                    if cf.get("customField", {}).get("name") == "Version Prod":
                        version_prod = cf.get("selectedOptions", [{}])[0].get("value")
                        break
            version_by_gid[node["id"]] = version_prod
        filtered = [
            issue for issue in all_issues
            if version_by_gid.get(f"gid://gitlab/WorkItem/{issue['id']}") == version
        ]
        logger.info(
            'GitLab: %s/%s issue(s) avec Version Prod="%s" (project=%s)',
            len(filtered), len(all_issues), version, project_id,
        )
        return self._filtered(all_issues, filtered)

    async def get_issues_by_version_only(self, project_id: str | int, version: str) -> PaginatedList:
        todo_status_gid = getattr(settings, "gitlab_status_todo", None) or "gid://gitlab/WorkItems::Statuses::Custom::Status/15"
        all_issues = await self._get_paginated(f"/projects/{project_id}/issues", {"state": "opened", "scope": "all"})
        if not all_issues:
            return []
        ids = [f"gid://gitlab/WorkItem/{issue['id']}" for issue in all_issues]
        query = """
        query GetVersionsAndStatus($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on WorkItem {
              id
              widgets {
                type
                ... on WorkItemWidgetCustomFields {
                  customFieldValues {
                    customField { id name }
                    ... on WorkItemSelectFieldValue { selectedOptions { value } }
                  }
                }
                ... on WorkItemWidgetStatus {
                  status { id name }
                }
              }
            }
          }
        }
        """
        data = await self._graphql(query, {"ids": ids})
        info_by_gid: dict[str, dict[str, Any]] = {}
        for node in data.get("nodes", []):
            version_val = None
            status_gid = None
            for widget in node.get("widgets", []):
                if widget.get("type") == "STATUS" and widget.get("status"):
                    status_gid = widget["status"]["id"]
                if isinstance(widget.get("customFieldValues"), list):
                    for cf in widget.get("customFieldValues", []):
                        if cf.get("customField", {}).get("name") == "Version Prod":
                            version_val = cf.get("selectedOptions", [{}])[0].get("value")
            info_by_gid[node["id"]] = {"version": version_val, "status_gid": status_gid}
        filtered = [
            issue for issue in all_issues
            if info_by_gid.get(f"gid://gitlab/WorkItem/{issue['id']}", {}).get("version") == version
            and info_by_gid.get(f"gid://gitlab/WorkItem/{issue['id']}", {}).get("status_gid") == todo_status_gid
        ]
        logger.info(
            'GitLab: %s/%s issue(s) avec Version Prod="%s" + status TODO (project=%s)',
            len(filtered), len(all_issues), version, project_id,
        )
        return filtered

    async def _get_project_full_path(self, project_id: str | int) -> str:
        if project_id not in self._project_path_cache:
            project = await self._rest_get(f"/projects/{project_id}")
            self._project_path_cache[project_id] = project["path_with_namespace"]
        return self._project_path_cache[project_id]

    async def search_issue_by_title(
        self, project_id: str | int, title: str
    ) -> dict[str, Any] | None:
        """Search for an issue by exact title match across the whole project."""
        normalized_title = (title or "").lower().strip()
        if not normalized_title:
            return None
        issues = await self._get_paginated(
            f"/projects/{project_id}/issues",
            {"search": title, "state": "all", "scope": "all", "per_page": 20},
        )
        for issue in issues:
            if (issue.get("title") or "").lower().strip() == normalized_title:
                return issue
        return None

    async def get_issues_by_label_and_iteration(
        self,
        project_id: str | int,
        label: str | None = None,
        iteration_id: str | int | None = None,
        gitlab_status: str | None = None,
        version_prod: str | None = None,
    ) -> PaginatedList:
        params: dict[str, Any] = {"state": "all", "order_by": "created_at", "sort": "desc"}
        if label:
            params["labels"] = label
        if iteration_id is not None:
            params["iteration_id"] = iteration_id
        issues = await self._get_paginated(
            f"/projects/{project_id}/issues",
            params,
        )

        # If no custom-field filters requested, return raw REST result
        if not gitlab_status and not version_prod:
            return issues

        # Batch GraphQL to read Status widget + CustomFields for each issue
        if not issues:
            return PaginatedList()

        full_path = await self._get_project_full_path(project_id)
        filtered: list[dict[str, Any]] = []
        BATCH_SIZE = 50
        for i in range(0, len(issues), BATCH_SIZE):
            batch = issues[i : i + BATCH_SIZE]
            iids = [str(issue["iid"]) for issue in batch]
            query = """
            query GetCustomFields($fullPath: ID!, $iids: [String!]!) {
              project(fullPath: $fullPath) {
                workItems(types: [ISSUE], first: 100, iids: $iids) {
                  nodes {
                    iid
                    widgets {
                      type
                      ... on WorkItemWidgetCustomFields {
                        customFieldValues {
                          customField { name }
                          ... on WorkItemSelectFieldValue { selectedOptions { value } }
                        }
                      }
                      ... on WorkItemWidgetStatus {
                        status { name }
                      }
                    }
                  }
                }
              }
            }
            """
            data = await self._graphql(query, {"fullPath": full_path, "iids": iids})
            info_by_iid: dict[str, dict[str, Any]] = {}
            for node in data.get("project", {}).get("workItems", {}).get("nodes", []):
                node_status = None
                node_version = None
                for widget in node.get("widgets", []):
                    if widget.get("type") == "STATUS" and widget.get("status"):
                        node_status = widget["status"]["name"]
                    if isinstance(widget.get("customFieldValues"), list):
                        for cf in widget.get("customFieldValues", []):
                            if cf.get("customField", {}).get("name") == "Version Prod":
                                opts = cf.get("selectedOptions")
                                if opts:
                                    node_version = opts[0].get("value")
                info_by_iid[str(node["iid"])] = {"status": node_status, "version_prod": node_version}

            for issue in batch:
                info = info_by_iid.get(str(issue["iid"]), {})
                if gitlab_status and info.get("status") != gitlab_status:
                    continue
                if version_prod and info.get("version_prod") != version_prod:
                    continue
                filtered.append(issue)

        logger.info(
            'GitLab: %s/%s issue(s) après filtre custom fields (status=%s, version_prod=%s)',
            len(filtered), len(issues), gitlab_status, version_prod,
        )
        return self._filtered(issues, filtered)

    async def get_issue_notes(self, project_id: str | int, issue_iid: int) -> PaginatedList:
        notes = await self._get_paginated(f"/projects/{project_id}/issues/{issue_iid}/notes")
        return self._filtered(notes, [n for n in notes if not n.get("system")])

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
        """Update a Work Item status via GraphQL (status widget)."""
        query = """
        mutation UpdateWorkItemStatus($id: WorkItemID!, $statusId: WorkItemsStatusesStatusID!) {
          workItemUpdate(input: {id: $id, statusWidget: {status: $statusId}}) {
            workItem {
              id
              widgets {
                type
                ... on WorkItemWidgetStatus {
                  status { id name }
                }
              }
            }
            errors
          }
        }
        """
        async with self.cb_graphql:
            resp = await self.graphql.post(
                "/api/graphql",
                json={"query": query, "variables": {"id": work_item_global_id, "statusId": status_global_id}},
            )
            resp.raise_for_status()
            result = resp.json()
            if result.get("errors"):
                raise httpx.HTTPStatusError(
                    f"GraphQL errors: {result['errors']}",
                    request=resp.request,
                    response=resp,
                )
            work_item_update = result.get("data", {}).get("workItemUpdate", {})
            errors = work_item_update.get("errors", [])
            if errors:
                raise httpx.HTTPStatusError(
                    f"GraphQL errors: {errors}",
                    request=resp.request,
                    response=resp,
                )
            work_item = work_item_update.get("workItem", {})
            status_name = None
            for widget in work_item.get("widgets", []):
                if widget.get("type") == "STATUS" and widget.get("status"):
                    status_name = widget["status"]["name"]
                    break
            logger.info("GitLab: Work item %s → status \"%s\"", work_item_global_id, status_name)
            return work_item

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

    async def get_project_iterations(self, project_id: str | int, search: str | None = None) -> PaginatedList:
        params: dict[str, Any] = {"state": "all"}
        if search:
            params["search"] = search
        return await self._get_paginated(f"/projects/{project_id}/iterations", params)

    async def get_project_issues(
        self, project_id: str | int, state: str = "all", labels: list[str] | None = None, search: str | None = None
    ) -> PaginatedList:
        params: dict[str, Any] = {"state": state}
        if labels:
            params["labels"] = labels
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
