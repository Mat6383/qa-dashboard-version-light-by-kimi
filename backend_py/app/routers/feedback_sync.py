"""Feedback sync REST router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.deps import DBMain
from app.schemas import FeedbackSyncRunPayload
from app.services.feedback_sync import feedback_sync_service
from app.projects_config import SYNC_PROJECTS, resolve_gitlab_project_id
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/run")
async def run_feedback_sync(payload: FeedbackSyncRunPayload, db: DBMain) -> dict[str, Any]:
    """Manually trigger a feedback sync scan for a project."""
    # Resolve project mapping
    project_cfg = None
    for p in SYNC_PROJECTS:
        if p.get("testmo", {}).get("projectId") == payload.project_id:
            project_cfg = p
            break

    if not project_cfg:
        return {
            "success": False,
            "error": f"Project with testmo_project_id={payload.project_id} not configured",
        }

    gitlab_project_id = resolve_gitlab_project_id(project_cfg["id"])
    if not gitlab_project_id:
        return {"success": False, "error": f"GitLab project not configured for {project_cfg['id']}"}

    try:
        summary = await feedback_sync_service.scan_project(
            testmo_project_id=payload.project_id,
            gitlab_project_id=gitlab_project_id,
            active_only=payload.active_only,
            run_ids=payload.run_ids,
            triggered_by="manual",
            db=db,
        )
        return {"success": True, "data": summary}
    except Exception as exc:
        logger.error("Feedback sync run failed: %s", exc)
        return {"success": False, "error": str(exc)}


@router.get("/history")
async def feedback_sync_history(db: DBMain, limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    history = await feedback_sync_service.get_history(db, limit=limit)
    return {"success": True, "data": history}


@router.get("/config")
async def feedback_sync_config() -> dict[str, Any]:
    return {
        "success": True,
        "data": {
            "interval_minutes": 30,
            "enabled": True,
        },
    }
