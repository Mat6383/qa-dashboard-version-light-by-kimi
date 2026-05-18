"""Testmo business-metrics layer — KPIs, SLA, trends, escape/detection rates."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from app.config import settings
from app.utils.logger import get_logger

if TYPE_CHECKING:
    from app.services.testmo_client import TestmoClient

logger = get_logger(__name__)

# Testmo result status ID constants (non-standard, business-critical)
STATUS_KEY_PASSED = "status1_count"
STATUS_KEY_FAILED = "status2_count"
STATUS_KEY_RETEST = "status3_count"
STATUS_KEY_BLOCKED = "status4_count"
STATUS_KEY_SKIPPED = "status5_count"
STATUS_KEY_WIP = "status7_count"


class TestmoMetrics:
    def __init__(self, client: TestmoClient) -> None:
        self._client = client

    def _is_prod_run(self, name: str | None) -> bool:
        n = (name or "").lower()
        for k in settings.testmo_preprod_keywords:
            if k in n:
                return False
        return any(k in n for k in settings.testmo_prod_keywords)

    def _run_to_dict(self, run: dict[str, Any], is_exploratory: bool = False) -> dict[str, Any]:
        def _pct(num: float, den: float) -> float:
            return round((num / den) * 100, 2) if den else 0.0

        return {
            "id": run["id"],
            "name": run["name"],
            "total": run.get("total_count", 0),
            "completed": run.get("completed_count", 0),
            "passed": run.get(STATUS_KEY_PASSED, 0),
            "failed": run.get(STATUS_KEY_FAILED, 0),
            "blocked": run.get(STATUS_KEY_BLOCKED, 0),
            "skipped": run.get(STATUS_KEY_SKIPPED, 0),
            "wip": run.get(STATUS_KEY_WIP, 0),
            "untested": run.get("untested_count", 0),
            "completionRate": _pct(run.get("completed_count", 0), run.get("total_count", 0)),
            "passRate": _pct(run.get(STATUS_KEY_PASSED, 0), run.get("completed_count", 0)),
            "created_at": run.get("created_at"),
            "milestone": run.get("milestone_id"),
            "isExploratory": is_exploratory,
        }

    async def get_project_metrics(
        self, project_id: int, milestone_ids: list[int] | None = None
    ) -> dict[str, Any]:
        """Aggregate ISTQB/ITIL/LEAN KPIs from runs + sessions."""
        runs_data = await self._client.get_project_runs(project_id, active_only=True)
        runs = runs_data if isinstance(runs_data, list) else runs_data.get("result", [])
        sessions_data = await self._client.get_project_sessions(project_id, active_only=True)
        sessions = (
            sessions_data if isinstance(sessions_data, list) else sessions_data.get("result", [])
        )
        if milestone_ids:
            runs = [r for r in runs if r.get("milestone_id") in milestone_ids]
            sessions = [s for s in sessions if s.get("milestone_id") in milestone_ids]
        # Exclure les runs de production de la section préprod (mais garder les TNR)
        runs = [r for r in runs if not self._is_prod_run(r.get("name"))]
        # Les sessions exploratoires sont traitées comme préprod par défaut

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
            aggregated["passed"] += run.get(STATUS_KEY_PASSED, 0)
            aggregated["failed"] += run.get(STATUS_KEY_FAILED, 0)
            aggregated["retest"] += run.get(STATUS_KEY_RETEST, 0)
            aggregated["blocked"] += run.get(STATUS_KEY_BLOCKED, 0)
            aggregated["skipped"] += run.get(STATUS_KEY_SKIPPED, 0)
            aggregated["wip"] += run.get(STATUS_KEY_WIP, 0)
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
            now_ts = datetime.now(timezone.utc).timestamp()
            runs_with_created_at = [r for r in runs if r.get("created_at")]
            lead_time = round(
                sum(
                    (
                        now_ts
                        - datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")).timestamp()
                    )
                    / 3600
                    for r in runs_with_created_at
                )
                / len(runs_with_created_at)
                if runs_with_created_at
                else 0.0,
                1,
            )
            mttr = round(lead_time * (aggregated["failed"] / (aggregated["passed"] or 1)), 1)

        all_runs = [self._run_to_dict(r, is_exploratory=False) for r in runs]
        all_runs.extend([self._run_to_dict(s, is_exploratory=True) for s in sessions])

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
                "colors": [
                    "#10B981",
                    "#EF4444",
                    "#8B5CF6",
                    "#F59E0B",
                    "#6B7280",
                    "#9CA3AF",
                    "#3B82F6",
                ],
            },
            "runsCount": len(runs) + len(sessions),
            "runs": all_runs,
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
                "activeRuns": len(runs) + len(sessions),
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
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "Pass Rate",
                    "value": metrics["passRate"],
                    "threshold": 85,
                    "message": f"Pass rate critique: {metrics['passRate']}% < 85%",
                }
            )
        elif metrics["passRate"] < 90:
            alerts.append(
                {
                    "severity": "warning",
                    "metric": "Pass Rate",
                    "value": metrics["passRate"],
                    "threshold": 90,
                    "message": f"Pass rate en warning: {metrics['passRate']}% < 90%",
                }
            )
        if metrics["blockedRate"] > 5:
            alerts.append(
                {
                    "severity": "warning",
                    "metric": "Blocked Rate",
                    "value": metrics["blockedRate"],
                    "threshold": 5,
                    "message": f"Trop de tests bloqués: {metrics['blockedRate']}% > 5%",
                }
            )
        if metrics["completionRate"] < 80:
            alerts.append(
                {
                    "severity": "warning",
                    "metric": "Completion Rate",
                    "value": metrics["completionRate"],
                    "threshold": 80,
                    "message": f"Avancement insuffisant: {metrics['completionRate']}% < 80%",
                }
            )
        return {"ok": len(alerts) == 0, "alerts": alerts}

    # ── Private helpers for quality rates ────────────────────────────────────

    async def _count_prod_bugs(self, run_list: list[dict[str, Any]]) -> int:
        """Count bugs linked to production runs (issues + fallback via results)."""
        bugs = 0
        seen_ids: set[int | str] = set()
        fallback_runs: list[dict[str, Any]] = []
        for run in run_list:
            rid = run.get("id")
            if rid in seen_ids:
                continue
            seen_ids.add(rid)
            issues = run.get("issues", [])
            if issues:
                bugs += len(issues)
            else:
                fallback_runs.append(run)
        if fallback_runs:
            sem = asyncio.Semaphore(5)

            async def _fetch(
                run: dict[str, Any],
            ) -> dict[str, Any] | list[dict[str, Any]] | Exception:
                run_id = run.get("id")
                if not isinstance(run_id, int):
                    return Exception(f"Invalid run id: {run_id!r}")
                async with sem:
                    try:
                        return await self._client.get_run_results(run_id, expands="issues")
                    except Exception as exc:
                        return exc

            responses = await asyncio.gather(*[_fetch(run) for run in fallback_runs])
            for resp in responses:
                if isinstance(resp, Exception):
                    continue
                results = resp.get("result", []) if isinstance(resp, dict) else resp
                bugs += sum(len(res.get("issues", [])) for res in results if res.get("issues"))
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
        preprod_runs = (
            [r for r in runs if r.get("milestone_id") in preprod_ids] if preprod_ids else []
        )
        prod_runs = (
            [
                r
                for r in runs
                if r.get("milestone_id") in prod_ids and self._is_prod_run(r.get("name"))
            ]
            if prod_ids
            else []
        )

        bugs_in_test = sum(r.get(STATUS_KEY_FAILED, 0) for r in preprod_runs)
        bugs_in_prod = await self._count_prod_bugs(prod_runs)
        total_bugs = bugs_in_test + bugs_in_prod

        milestones = await self._client.get_project_milestones(project_id)
        milestone_names = {str(m.get("id")): m.get("name", "") for m in milestones}
        preprod_name = (
            milestone_names.get(str(preprod_milestones[0]))
            if preprod_milestones
            else "Sélection manuelle"
        )
        prod_name = (
            milestone_names.get(str(prod_milestones[0]))
            if prod_milestones
            else "Sélection manuelle"
        )

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
        milestones = await self._client.get_project_milestones(project_id)
        active_milestones = [m for m in milestones if not m.get("is_completed")]
        active_milestones.sort(key=lambda m: m.get("id") or 0, reverse=True)

        if len(active_milestones) < 3:
            return {
                "escapeRate": 0.0,
                "detectionRate": 0.0,
                "projectId": project_id,
                "bugsInTest": 0,
                "bugsInProd": 0,
                "totalBugs": 0,
                "preprodMilestone": active_milestones[0].get("name", "N/A")
                if active_milestones
                else "N/A",
                "prodMilestone": active_milestones[2].get("name", "N/A")
                if len(active_milestones) > 2
                else "N/A",
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
                "preprodMilestone": preprod_milestone.get("name", "N/A")
                if preprod_milestone
                else "N/A",
                "prodMilestone": prod_milestone.get("name", "N/A") if prod_milestone else "N/A",
                "message": "Impossible de trouver 3 milestones avec de l'activité (runs/sessions).",
            }

        test_runs = [r for r in prod_runs_auto if not self._is_prod_run(r.get("name"))]
        bugs_in_test = sum(r.get(STATUS_KEY_FAILED, 0) for r in test_runs)

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
        self,
        project_id: int,
        preprod_milestones: list[int] | None = None,
        prod_milestones: list[int] | None = None,
    ) -> dict[str, Any]:
        """Compare bugs found in preprod vs prod using milestone filters."""
        runs_data = await self._client.get_project_runs(project_id)
        runs = runs_data.get("result", []) if isinstance(runs_data, dict) else runs_data
        if not runs:
            return {"escapeRate": 0.0, "detectionRate": 0.0, "projectId": project_id}

        preprod_ids = set(preprod_milestones or [])
        prod_ids = set(prod_milestones or [])

        if preprod_ids or prod_ids:
            return await self._rates_from_explicit_milestones(
                runs, preprod_milestones, prod_milestones, project_id
            )
        return await self._rates_from_auto_milestones(runs, project_id)

    async def get_annual_quality_trends(self, project_id: int) -> list[dict[str, Any]]:
        """Aggregate metrics per year from runs."""
        runs_data = await self._client.get_project_runs(project_id)
        runs = runs_data.get("result", []) if isinstance(runs_data, dict) else runs_data
        years: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"passed": 0, "failed": 0, "blocked": 0, "total": 0}
        )
        for r in runs:
            started = r.get("started_at") or r.get("created_at")
            if not started:
                continue
            if isinstance(started, datetime):
                year = str(started.year)
            elif isinstance(started, str):
                year = started[:4]
            else:
                try:
                    year = str(datetime.fromtimestamp(float(started)).year)
                except (ValueError, TypeError, OSError):
                    year = str(started)[:4]
            # Utilise les mêmes champs que get_project_metrics (status ID mapping)
            years[year]["passed"] += r.get(STATUS_KEY_PASSED, 0)
            years[year]["failed"] += r.get(STATUS_KEY_FAILED, 0)
            years[year]["blocked"] += r.get(STATUS_KEY_BLOCKED, 0)
            years[year]["total"] += r.get("total_count", 0)

        trends = []
        for year in sorted(years.keys()):
            y = years[year]
            completed = y["passed"] + y["failed"]
            bugs_in_test = y["failed"]
            bugs_in_prod = y["blocked"]
            total_bugs = bugs_in_test + bugs_in_prod
            trends.append(
                {
                    "version": year,
                    "date": f"{year}-01-01",
                    "passRate": round(y["passed"] / completed * 100, 2) if completed else 0.0,
                    "completionRate": round(completed / y["total"] * 100, 2) if y["total"] else 0.0,
                    "blockedRate": round(y["blocked"] / y["total"] * 100, 2) if y["total"] else 0.0,
                    "totalTests": y["total"],
                    "bugsInTest": bugs_in_test,
                    "bugsInProd": bugs_in_prod,
                    "totalBugs": total_bugs,
                    "detectionRate": round(bugs_in_test / total_bugs * 100, 2)
                    if total_bugs
                    else 0.0,
                    "escapeRate": round(bugs_in_prod / total_bugs * 100, 2) if total_bugs else 0.0,
                }
            )
        return trends

    async def compare_projects(self, project_ids: list[int]) -> list[dict[str, Any]]:
        """Metrics comparison across multiple projects."""
        sem = asyncio.Semaphore(5)

        async def _fetch(pid: int) -> dict[str, Any] | Exception:
            async with sem:
                try:
                    return await self.get_project_metrics(pid)
                except Exception as exc:
                    return exc

        tasks = [_fetch(pid) for pid in project_ids]
        metrics_list = await asyncio.gather(*tasks)
        results: list[dict[str, Any]] = []
        for pid, metrics in zip(project_ids, metrics_list):
            if isinstance(metrics, Exception):
                logger.warning("Failed to fetch metrics for project %s: %s", pid, metrics)
                continue
            results.append({"project_id": pid, **metrics})
        return results
