"""GitLab ↔ Testmo sync with SSE streaming."""

from __future__ import annotations

import json
from typing import AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.config import settings
from app.deps import DBMain, require_admin_token
from app.schemas import (
    AutoConfigResponse,
    SyncExecutePayload,
    SyncHistoryResponse,
    SyncPreviewPayload,
    SyncStatusPayload,
)
from app.services.sync import sync_service
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/projects")
async def sync_projects(db: DBMain):
    projects = await sync_service.list_sync_projects()
    return {"success": True, "data": projects}


@router.get("/{project_id}/iterations")
async def get_iterations(project_id: int | str, search: str | None = Query(None), db: DBMain = None):
    iterations = await sync_service.list_iterations(project_id, search)
    return {"success": True, "data": iterations}


@router.post("/preview")
async def sync_preview(payload: SyncPreviewPayload, db: DBMain):
    preview = await sync_service.preview_sync(
        payload.project_id,
        payload.iteration_name,
        payload.run_id,
        payload.version,
        payload.source,
        payload.testmo_project_id,
    )
    return {"success": True, "data": preview}


@router.post("/execute")
async def sync_execute(request: Request, payload: SyncExecutePayload, db: DBMain):
    async def event_generator() -> AsyncGenerator[str, None]:
        stats = {"created": 0, "updated": 0, "skipped": 0, "enriched": 0, "errors": 0, "total_issues": 0}
        async for event in sync_service.execute_sync(
            payload.project_id,
            payload.iteration_name,
            payload.run_id,
            payload.version,
            payload.dry_run,
            payload.source,
            payload.testmo_project_id,
        ):
            if await request.is_disconnected():
                logger.info("Sync execute SSE disconnected")
                break
            # Accumulate summary stats
            if event.get("level") == "summary":
                stats["created"] = event.get("created", 0)
                stats["updated"] = event.get("updated", 0)
                stats["skipped"] = event.get("skipped", 0)
                stats["enriched"] = event.get("enriched", 0)
                stats["errors"] = event.get("errors", 0)
                stats["total_issues"] = event.get("total_issues", 0)
                stats["testmo_run_id"] = event.get("testmo_run_id")
                stats["testmo_run_url"] = event.get("testmo_run_url")
            yield f"data: {json.dumps(event)}\n\n"

        # Persist to DB after stream ends
        try:
            await sync_service.persist_run(
                db, str(payload.project_id), payload.iteration_name, stats
            )
        except Exception as exc:
            logger.error("Failed to persist sync run", extra={"error": str(exc)})
        yield f"data: {json.dumps({'level': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/status-to-gitlab")
async def sync_status_to_gitlab(request: Request, payload: SyncStatusPayload, db: DBMain):
    async def event_generator() -> AsyncGenerator[str, None]:
        async for event in sync_service.sync_status_to_gitlab(
            payload.project_id, payload.iteration_name, payload.run_id
        ):
            if await request.is_disconnected():
                break
            yield f"data: {json.dumps(event)}\n\n"
        yield f"data: {json.dumps({'level': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/history")
async def sync_history(db: DBMain):
    history = await sync_service.get_history(db)
    return {"success": True, "data": history}


@router.get("/auto-config")
async def get_auto_config():
    return {"success": True, "data": sync_service.get_auto_config()}


@router.put("/auto-config")
async def update_auto_config(payload: dict, db: DBMain):
    updated = await sync_service.update_auto_config(payload)
    return {"success": True, "data": updated}


@router.post("/test-api", dependencies=[Depends(require_admin_token)])
async def test_api():
    return {"status": "ok"}
