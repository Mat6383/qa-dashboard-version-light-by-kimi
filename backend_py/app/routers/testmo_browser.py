"""Testmo Browser Router — manual run creation & results via Playwright."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.deps import require_admin
from app.services.testmo_browser import testmo_browser_service
from app.utils.api_helpers import sanitize_errors
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/runs")
@sanitize_errors(logger, msg="[TestmoBrowserAPI] Create run error")
async def create_manual_run(
    payload: dict[str, Any],
    _admin: Any = Depends(require_admin),
) -> dict[str, Any]:
    project_id = payload.get("projectId")
    name = payload.get("name")
    if not project_id or not name:
        return {"success": False, "error": "projectId and name are required"}

    logger.info('[TestmoBrowserAPI] Creating manual run "%s" in project %s', name, project_id)
    result = await testmo_browser_service.create_manual_run(
        int(project_id),
        {
            "name": str(name),
            "milestoneId": payload.get("milestoneId"),
            "configId": payload.get("configId"),
            "caseIds": payload.get("caseIds"),
        },
    )
    return {"success": True, "data": result}


@router.post("/runs/{run_id}/results")
@sanitize_errors(logger, msg="[TestmoBrowserAPI] Add results error")
async def add_run_results(
    run_id: int,
    payload: dict[str, Any],
    _admin: Any = Depends(require_admin),
) -> dict[str, Any]:
    project_id = payload.get("projectId")
    results = payload.get("results")
    if not run_id or not project_id or not isinstance(results, list):
        return {"success": False, "error": "runId, projectId and results[] are required"}

    logger.info("[TestmoBrowserAPI] Adding %s results to run %s", len(results), run_id)
    stats = await testmo_browser_service.add_run_results(
        int(project_id), run_id, results
    )
    return {"success": True, "data": stats}


@router.get("/health")
async def health_check(_admin: Any = Depends(require_admin)) -> dict[str, Any]:
    check = await testmo_browser_service.health_check()
    status_code = 200 if check["ok"] else 503
    return {"success": check["ok"], "data": check, "status_code": status_code}
