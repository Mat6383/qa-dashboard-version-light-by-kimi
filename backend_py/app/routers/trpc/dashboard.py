import asyncio
from typing import Any

from app.services.testmo import testmo_service
from app.utils.logger import get_logger

from app.routers.trpc._common import _result

logger = get_logger(__name__)


async def _dashboard_metrics(input_data: dict[str, Any], db) -> dict[str, Any]:
    project_id = input_data.get("projectId")
    preprod = input_data.get("preprodMilestones") or []
    prod = input_data.get("prodMilestones") or []
    milestone_ids = list(set(preprod + prod)) if (preprod or prod) else None
    metrics = await testmo_service.get_project_metrics(project_id, milestone_ids=milestone_ids)
    return _result(metrics)


async def _dashboard_quality_rates(input_data: dict[str, Any], db) -> dict[str, Any]:
    project_id = input_data.get("projectId")
    preprod = input_data.get("preprodMilestones")
    prod = input_data.get("prodMilestones")
    rates = await testmo_service.get_escape_and_detection_rates(project_id, preprod, prod)
    return _result(rates)


async def _dashboard_multi_project_summary(
    _input_data: dict[str, Any] | None, db
) -> dict[str, Any]:
    projects = await testmo_service.get_projects()

    async def _summary_for_project(p: dict[str, Any]) -> dict[str, Any] | None:
        try:
            metrics = await testmo_service.get_project_metrics(p["id"])
            return {
                "projectId": p["id"],
                "projectName": p.get("name"),
                "passRate": metrics.get("pass_rate"),
                "completionRate": metrics.get("completion_rate"),
                "blockedRate": metrics.get("blocked_rate"),
                "escapeRate": metrics.get("escape_rate"),
                "detectionRate": metrics.get("detection_rate"),
                "timestamp": metrics.get("timestamp"),
            }
        except Exception as exc:
            logger.warning("Failed to fetch metrics for project %s: %s", p.get("id"), exc)
            return None

    summary_tasks = [_summary_for_project(p) for p in projects]
    summaries = [s for s in await asyncio.gather(*summary_tasks) if s is not None]
    return _result(summaries)
