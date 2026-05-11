"""Testmo API client with cache, dedup & circuit breaker."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Callable, cast

import httpx
from cachetools import TTLCache

from app.config import settings
from app.core.circuit_breaker import CircuitBreaker
from app.core.resilience import with_resilience
from app.utils.logger import get_logger

logger = get_logger(__name__)


class PaginatedList(list):
    """A list that carries a ``truncated`` flag when pagination was capped."""
    truncated: bool = False


class TestmoService:
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

    async def get_projects(self) -> list[dict[str, Any]]:
        key = self._cache_key("projects")

        async def _fetch() -> Any:
            data = await self._get("/projects", {"per_page": 100})
            return data if isinstance(data, list) else data.get("result", [])

        result: list[dict[str, Any]] = await self._cached_request(key, _fetch)
        return result

    async def get_project_runs(self, project_id: int, active_only: bool = False) -> list[dict[str, Any]]:
        key = self._cache_key("runs", project_id, "active" if active_only else "all")

        async def _fetch() -> Any:
            params: dict[str, Any] = {"per_page": 100}
            if active_only:
                params["is_closed"] = "0"
            data = await self._get(f"/projects/{project_id}/runs", params)
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
        result: dict[str, Any] = await self._cached_request(key, lambda: self._get(f"/runs/{run_id}"))
        return result

    async def get_automation_run_details(self, run_id: int) -> dict[str, Any]:
        key = self._cache_key("automation_run", run_id)
        result: dict[str, Any] = await self._cached_request(key, lambda: self._get(f"/automation/runs/{run_id}"))
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
            data = cast(dict[str, Any], await self._get(f"/projects/{project_id}/cases", {"page": page}))
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
            logger.warning("[StatusSync] %s case_id(s) introuvable(s): %s", len(remaining), ", ".join(str(x) for x in remaining))
        return names

    async def get_run_results(self, run_id: int, status_filter: str | None = None) -> dict[str, Any]:
        key = self._cache_key("results", run_id, status_filter or "all")
        params = {}
        if status_filter:
            params["status"] = status_filter

        async def _fetch() -> Any:
            return await self._get(f"/runs/{run_id}/results", params)

        result: dict[str, Any] = await self._cached_request(key, _fetch)
        return result

    def _is_prod_run(self, name: str | None) -> bool:
        n = (name or "").lower()
        for k in settings.testmo_preprod_keywords:
            if k in n:
                return False
        return any(k in n for k in settings.testmo_prod_keywords)

    async def get_project_metrics(self, project_id: int, milestone_ids: list[int] | None = None) -> dict[str, Any]:
        """Aggregate ISTQB/ITIL/LEAN KPIs from runs + sessions."""
        runs_data = await self.get_project_runs(project_id, active_only=True)
        runs = runs_data if isinstance(runs_data, list) else runs_data.get("result", [])
        if milestone_ids:
            runs = [r for r in runs if r.get("milestone_id") in milestone_ids]
        # Exclure les runs de production de la section préprod (mais garder les TNR)
        runs = [r for r in runs if not self._is_prod_run(r.get("name"))]

        # Aggregated counters
        aggregated = {
            "total": 0,
            "untested": 0,
            "passed": 0,
            "failed": 0,
            "retest": 0,
            "blocked": 0,
            "skipped": 0,
            "wip": 0,
            "completed": 0,
            "success": 0,
            "failure": 0,
        }

        for run in runs:
            aggregated["total"] += run.get("total_count", 0)
            aggregated["untested"] += run.get("untested_count", 0)
            aggregated["passed"] += run.get("status1_count", 0)
            aggregated["failed"] += run.get("status2_count", 0)
            aggregated["retest"] += run.get("status3_count", 0)
            aggregated["blocked"] += run.get("status4_count", 0)
            aggregated["skipped"] += run.get("status5_count", 0)
            aggregated["wip"] += run.get("status7_count", 0)
            aggregated["completed"] += run.get("completed_count", 0)
            aggregated["success"] += run.get("success_count", 0)
            aggregated["failure"] += run.get("failure_count", 0)

        total = aggregated["total"] or 1  # avoid division by zero
        completed = aggregated["completed"] or 1

        def _pct(num: float, den: float) -> float:
            return round((num / den) * 100, 2) if den else 0.0

        completion_rate = _pct(aggregated["completed"], total)
        pass_rate = _pct(aggregated["passed"], completed)
        failure_rate = _pct(aggregated["failed"], completed)
        blocked_rate = _pct(aggregated["blocked"], total)
        skipped_rate = _pct(aggregated["skipped"], total)
        test_efficiency = _pct(aggregated["passed"], aggregated["passed"] + aggregated["failed"])

        # ITIL metrics
        lead_time = 0.0
        mttr = 0.0
        if runs:
            lead_time = round(
                sum(
                    (datetime.now(timezone.utc).timestamp() - datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")).timestamp()) / 3600
                    for r in runs if r.get("created_at")
                )
                / len(runs),
                1,
            )
            mttr = round(lead_time * (aggregated["failed"] / (aggregated["passed"] or 1)), 1)

        result_metrics: dict[str, Any] = {
            "raw": aggregated,
            "completionRate": completion_rate,
            "passRate": pass_rate,
            "failureRate": failure_rate,
            "blockedRate": blocked_rate,
            "skippedRate": skipped_rate,
            "testEfficiency": test_efficiency,
            "statusDistribution": {
                "labels": ["Passed", "Failed", "Retest", "Blocked", "Skipped", "Untested", "WIP"],
                "values": [
                    aggregated["passed"],
                    aggregated["failed"],
                    aggregated["retest"],
                    aggregated["blocked"],
                    aggregated["skipped"],
                    aggregated["untested"],
                    aggregated["wip"],
                ],
                "colors": ["#10B981", "#EF4444", "#8B5CF6", "#F59E0B", "#6B7280", "#9CA3AF", "#3B82F6"],
            },
            "runsCount": len(runs),
            "runs": [
                {
                    "id": run["id"],
                    "name": run["name"],
                    "total": run.get("total_count", 0),
                    "completed": run.get("completed_count", 0),
                    "passed": run.get("status1_count", 0),
                    "failed": run.get("status2_count", 0),
                    "blocked": run.get("status4_count", 0),
                    "skipped": run.get("status5_count", 0),
                    "wip": run.get("status7_count", 0),
                    "untested": run.get("untested_count", 0),
                    "completionRate": _pct(run.get("completed_count", 0), run.get("total_count", 0)),
                    "passRate": _pct(run.get("status1_count", 0), run.get("completed_count", 0)),
                    "created_at": run.get("created_at"),
                    "milestone": run.get("milestone_id"),
                    "isExploratory": False,
                }
                for run in runs
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "itil": {
                "mttr": mttr,
                "mttrTarget": 72,
                "leadTime": lead_time,
                "leadTimeTarget": 120,
                "changeFailRate": failure_rate,
                "changeFailRateTarget": 20,
            },
            "lean": {
                "wipTotal": aggregated["wip"],
                "wipTarget": 20,
                "activeRuns": len(runs),
                "closedRuns": 0,
            },
            "istqb": {
                "avgPassRate": pass_rate,
                "passRateTarget": 80,
                "milestonesCompleted": 0,
                "milestonesTotal": 1,
                "blockRate": blocked_rate,
                "blockRateTarget": 5,
            },
        }

        result_metrics["slaStatus"] = self._check_sla(result_metrics)
        return result_metrics

    def _check_sla(self, metrics: dict[str, Any]) -> dict[str, Any]:
        alerts = []
        if metrics["passRate"] < 85:
            alerts.append({
                "severity": "critical",
                "metric": "Pass Rate",
                "value": metrics["passRate"],
                "threshold": 85,
                "message": f"Pass rate critique: {metrics['passRate']}% < 85%",
            })
        elif metrics["passRate"] < 90:
            alerts.append({
                "severity": "warning",
                "metric": "Pass Rate",
                "value": metrics["passRate"],
                "threshold": 90,
                "message": f"Pass rate en warning: {metrics['passRate']}% < 90%",
            })
        if metrics["blockedRate"] > 5:
            alerts.append({
                "severity": "warning",
                "metric": "Blocked Rate",
                "value": metrics["blockedRate"],
                "threshold": 5,
                "message": f"Trop de tests bloqués: {metrics['blockedRate']}% > 5%",
            })
        if metrics["completionRate"] < 80:
            alerts.append({
                "severity": "warning",
                "metric": "Completion Rate",
                "value": metrics["completionRate"],
                "threshold": 80,
                "message": f"Avancement insuffisant: {metrics['completionRate']}% < 80%",
            })
        return {"ok": len(alerts) == 0, "alerts": alerts}

    # ── Private helpers for quality rates ────────────────────────────────────

    async def _count_prod_bugs(self, run_list: list[dict[str, Any]]) -> int:
        """Count bugs linked to production runs (issues + fallback via results)."""
        bugs = 0
        fallback_runs: list[dict[str, Any]] = []
        for run in run_list:
            issues = run.get("issues", [])
            if issues:
                bugs += len(issues)
            else:
                fallback_runs.append(run)
        if fallback_runs:
            sem = asyncio.Semaphore(10)

            async def _fetch(run: dict[str, Any]) -> dict[str, Any] | list[dict[str, Any]] | Exception:
                run_id = run.get("id")
                if not run_id:
                    return Exception("Run without id")
                async with sem:
                    try:
                        return await self._get(f"/runs/{run_id}/results", {"expands": "issues"})
                    except Exception as exc:
                        return exc

            responses = await asyncio.gather(*[_fetch(run) for run in fallback_runs])
            for resp in responses:
                if isinstance(resp, Exception):
                    continue
                results = resp.get("result", []) if isinstance(resp, dict) else resp
                bugs += sum(
                    len(res.get("issues", []))
                    for res in results
                    if res.get("issues")
                )
        return bugs

    async def _rates_from_explicit_milestones(
        self,
        runs: list[dict[str, Any]],
        preprod_milestones: list[int] | None,
        prod_milestones: list[int] | None,
        project_id: int,
    ) -> dict[str, Any]:
        preprod_ids = set(preprod_milestones or [])
        prod_ids = set(prod_milestones or [])
        preprod_runs = [r for r in runs if r.get("milestone_id") in preprod_ids] if preprod_ids else []
        prod_runs = [r for r in runs if r.get("milestone_id") in prod_ids and self._is_prod_run(r.get("name"))] if prod_ids else []

        bugs_in_test = sum(r.get("status2_count", 0) for r in preprod_runs)
        bugs_in_prod = await self._count_prod_bugs(prod_runs)
        total_bugs = bugs_in_test + bugs_in_prod

        milestones = await self.get_project_milestones(project_id)
        milestone_names = {str(m.get("id")): m.get("name", "") for m in milestones}
        preprod_name = milestone_names.get(str(preprod_milestones[0])) if preprod_milestones else "Sélection manuelle"
        prod_name = milestone_names.get(str(prod_milestones[0])) if prod_milestones else "Sélection manuelle"

        return {
            "escapeRate": round((bugs_in_prod / total_bugs * 100) if total_bugs else 0.0, 2),
            "detectionRate": round((bugs_in_test / total_bugs * 100) if total_bugs else 0.0, 2),
            "projectId": project_id,
            "bugsInTest": bugs_in_test,
            "bugsInProd": bugs_in_prod,
            "totalBugs": total_bugs,
            "preprodMilestone": preprod_name or "Sélection manuelle",
            "prodMilestone": prod_name or "Sélection manuelle",
            "message": None,
        }

    async def _rates_from_auto_milestones(
        self,
        runs: list[dict[str, Any]],
        project_id: int,
    ) -> dict[str, Any]:
        milestones = await self.get_project_milestones(project_id)
        active_milestones = [m for m in milestones if not m.get("is_completed")]
        active_milestones.sort(key=lambda m: m.get("id", 0), reverse=True)

        if len(active_milestones) < 3:
            return {
                "escapeRate": 0.0,
                "detectionRate": 0.0,
                "projectId": project_id,
                "bugsInTest": 0,
                "bugsInProd": 0,
                "totalBugs": 0,
                "preprodMilestone": active_milestones[0].get("name", "N/A") if active_milestones else "N/A",
                "prodMilestone": active_milestones[2].get("name", "N/A") if len(active_milestones) > 2 else "N/A",
                "message": "Pas assez de milestones actives pour comparer (3 requises).",
            }

        preprod_milestone = None
        prod_milestone = None
        prod_runs_auto: list[dict[str, Any]] = []
        milestones_with_activity = 0

        for ms in active_milestones:
            ms_runs = [r for r in runs if r.get("milestone_id") == ms.get("id")]
            if ms_runs:
                milestones_with_activity += 1
                if milestones_with_activity == 1:
                    preprod_milestone = ms
                elif milestones_with_activity == 3:
                    prod_milestone = ms
                    prod_runs_auto = ms_runs
                    break

        if not preprod_milestone or not prod_milestone:
            return {
                "escapeRate": 0.0,
                "detectionRate": 0.0,
                "projectId": project_id,
                "bugsInTest": 0,
                "bugsInProd": 0,
                "totalBugs": 0,
                "preprodMilestone": preprod_milestone.get("name", "N/A") if preprod_milestone else "N/A",
                "prodMilestone": prod_milestone.get("name", "N/A") if prod_milestone else "N/A",
                "message": "Impossible de trouver 3 milestones avec de l'activité (runs/sessions).",
            }

        test_runs = [r for r in prod_runs_auto if not self._is_prod_run(r.get("name"))]
        bugs_in_test = sum(r.get("status2_count", 0) for r in test_runs)

        patch_runs = [r for r in prod_runs_auto if self._is_prod_run(r.get("name"))]
        bugs_in_prod = await self._count_prod_bugs(patch_runs)

        total_bugs = bugs_in_test + bugs_in_prod

        return {
            "escapeRate": round((bugs_in_prod / total_bugs * 100) if total_bugs else 0.0, 2),
            "detectionRate": round((bugs_in_test / total_bugs * 100) if total_bugs else 0.0, 2),
            "projectId": project_id,
            "bugsInTest": bugs_in_test,
            "bugsInProd": bugs_in_prod,
            "totalBugs": total_bugs,
            "preprodMilestone": preprod_milestone.get("name", "Sélection manuelle"),
            "prodMilestone": prod_milestone.get("name", "Sélection manuelle"),
            "message": None,
        }

    async def get_escape_and_detection_rates(
        self, project_id: int, preprod_milestones: list[int] | None = None, prod_milestones: list[int] | None = None
    ) -> dict[str, Any]:
        """Compare bugs found in preprod vs prod using milestone filters."""
        runs_data = await self.get_project_runs(project_id)
        runs = runs_data.get("result", []) if isinstance(runs_data, dict) else runs_data
        if not runs:
            return {"escapeRate": 0.0, "detectionRate": 0.0, "projectId": project_id}

        preprod_ids = set(preprod_milestones or [])
        prod_ids = set(prod_milestones or [])

        if preprod_ids or prod_ids:
            return await self._rates_from_explicit_milestones(runs, preprod_milestones, prod_milestones, project_id)
        return await self._rates_from_auto_milestones(runs, project_id)

    async def get_annual_quality_trends(self, project_id: int) -> list[dict[str, Any]]:
        """Aggregate metrics per year from runs."""
        runs_data = await self.get_project_runs(project_id)
        runs = runs_data.get("result", []) if isinstance(runs_data, dict) else runs_data
        years: dict[str, dict[str, Any]] = defaultdict(lambda: {"passed": 0, "failed": 0, "blocked": 0, "total": 0})
        for r in runs:
            started = r.get("started_at") or r.get("created_at")
            if not started:
                continue
            year = str(started)[:4] if isinstance(started, str) else started.year
            years[year]["passed"] += r.get("passed_count", 0)
            years[year]["failed"] += r.get("failed_count", 0)
            years[year]["blocked"] += r.get("blocked_count", 0)
            years[year]["total"] += r.get("cases_count", 0)

        trends = []
        for year in sorted(years.keys()):
            y = years[year]
            completed = y["passed"] + y["failed"]
            bugs_in_test = y["failed"]
            bugs_in_prod = y["blocked"]
            total_bugs = bugs_in_test + bugs_in_prod
            trends.append({
                "version": year,
                "date": f"{year}-01-01",
                "passRate": round(y["passed"] / completed * 100, 2) if completed else 0.0,
                "completionRate": round(completed / y["total"] * 100, 2) if y["total"] else 0.0,
                "blockedRate": round(y["blocked"] / y["total"] * 100, 2) if y["total"] else 0.0,
                "totalTests": y["total"],
                "bugsInTest": bugs_in_test,
                "bugsInProd": bugs_in_prod,
                "totalBugs": total_bugs,
                "detectionRate": round(bugs_in_test / total_bugs * 100, 2) if total_bugs else 0.0,
                "escapeRate": round(bugs_in_prod / total_bugs * 100, 2) if total_bugs else 0.0,
            })
        return trends

    async def compare_projects(self, project_ids: list[int]) -> list[dict[str, Any]]:
        """Metrics comparison across multiple projects."""
        results = []
        for pid in project_ids:
            metrics = await self.get_project_metrics(pid)
            results.append({"project_id": pid, **metrics})
        return results

    async def health_check(self) -> bool:
        try:
            await self._get("/projects", {"limit": 1})
            return True
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Automation runs (write operations)
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
        """Create a new automation run. Returns { id: int }."""
        payload: dict[str, Any] = {"name": name, "source": source}
        if tags:
            payload["tags"] = tags
        if milestone_id:
            payload["milestone_id"] = milestone_id
        if fields:
            payload["fields"] = fields
        if links:
            payload["links"] = links
        result: dict[str, Any] = await self._post(f"/projects/{project_id}/automation/runs", payload)
        return result

    async def find_automation_run(
        self,
        project_id: int,
        name: str,
        source: str | None = None,
    ) -> dict[str, Any] | None:
        """Search for an existing automation run by name (and optionally source)."""
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
        """Append metadata to an existing automation run."""
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
        """Create a thread inside an automation run. Returns { id: int }."""
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
        """Append test results to an automation thread."""
        payload: dict[str, Any] = {"tests": tests}
        if elapsed_observed is not None:
            payload["elapsed_observed"] = elapsed_observed
        if artifacts:
            payload["artifacts"] = artifacts
        if fields:
            payload["fields"] = fields
        result: dict[str, Any] = await self._post(f"/automation/runs/threads/{thread_id}/append", payload)
        return result

    async def complete_automation_run(
        self,
        run_id: int,
        measure_elapsed: bool = True,
    ) -> dict[str, Any]:
        """Mark an automation run as complete."""
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
        """List all cases in a project, optionally filtered by folder.
        Paginates until exhaustion."""
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
        """Find a case by exact name match within a project/folder."""
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
        """Create one or more cases in a project. Returns created cases."""
        if not cases:
            return []
        data = cast(dict[str, Any], await self._post(f"/projects/{project_id}/cases", {"cases": cases}))
        result = data.get("result") if isinstance(data, dict) else data
        return result if isinstance(result, list) else [result] if result else []

    async def update_case(
        self,
        project_id: int,
        case_id: int,
        case_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an existing case. Uses PATCH with ids array."""
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
        """List folders in a project, optionally filtered by parent."""
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
        """Create a folder in a project. Returns the created folder."""
        payload: dict[str, Any] = {"folders": [{"name": name}]}
        if parent_id is not None:
            payload["folders"][0]["parent_id"] = parent_id
        data = cast(dict[str, Any], await self._post(f"/projects/{project_id}/folders", payload))
        result = data.get("result") if isinstance(data, dict) else data
        created = cast(dict[str, Any], result[0] if isinstance(result, list) and result else data)
        logger.info("Testmo: Folder créé — %r (id=%s, parent=%s)", name, created.get("id"), parent_id)
        return created

    async def get_or_create_folder(
        self,
        project_id: int,
        name: str,
        parent_id: int | None = None,
        repo_id: int | None = None,
    ) -> dict[str, Any]:
        """Idempotent folder retrieval or creation."""
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
        """Internal helper to find a folder by exact name."""
        folders = await self.get_folders(project_id, parent_id, repo_id)
        for folder in folders:
            if folder.get("name") == name:
                return cast(dict[str, Any], folder)
        return None

    def clear_cache(self) -> None:
        self.cache.clear()
        logger.info("Testmo cache cleared")


testmo_service = TestmoService()
