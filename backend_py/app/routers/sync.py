"""GitLab ↔ Testmo sync with SSE streaming."""

from __future__ import annotations

import json
from typing import Any, AsyncGenerator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.config import settings
from app.deps import DBMain, require_admin_token
from app.projects_config import (
    get_sync_project,
    resolve_gitlab_project_id,
    resolve_testmo_project_id,
)
from app.schemas import (
    SyncCasesExecutePayload,
    SyncCasesPreviewPayload,
    SyncExecutePayload,
    SyncPreviewPayload,
    SyncStatusPayload,
)
from app.services.case_sync import _parse_folder_hierarchy, case_sync_service
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
    try:
        iterations = await sync_service.list_iterations(project_id, search)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(
                status_code=502,
                detail="GitLab authentication failed: the token is invalid or expired. Please check your GITLAB_TOKEN in backend_py/.env",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail=f"GitLab API error: HTTP {exc.response.status_code}",
        ) from exc
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
    gl_project_id = resolve_gitlab_project_id(payload.project_id)
    if not gl_project_id:
        async def _error_generator() -> AsyncGenerator[str, None]:
            yield f"data: {json.dumps({'level': 'error', 'message': f'Project {payload.project_id} not configured'})}\n\n"
            yield f"data: {json.dumps({'level': 'done'})}\n\n"
        return StreamingResponse(_error_generator(), media_type="text/event-stream")

    async def event_generator() -> AsyncGenerator[str, None]:
        async for event in sync_service.sync_status_to_gitlab(
            gl_project_id, payload.iteration_name, payload.run_id, dry_run=payload.dry_run, version=payload.version
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
    return {"success": True, "data": await sync_service.get_auto_config()}


@router.put("/auto-config")
async def update_auto_config(payload: dict, db: DBMain):
    updated = await sync_service.update_auto_config(payload)
    return {"success": True, "data": updated}


# ── Case Sync (P31) ─────────────────────────────────────

@router.post("/cases/preview")
async def sync_cases_preview(payload: SyncCasesPreviewPayload, db: DBMain) -> dict[str, Any]:
    gl_project_id = resolve_gitlab_project_id(payload.project_id)
    if not gl_project_id:
        return {"success": False, "error": f"Project '{payload.project_id}' not configured"}

    project_cfg = get_sync_project(payload.project_id)
    root_folder_id = project_cfg["testmo"]["rootFolderId"] if project_cfg else payload.root_folder_id

    try:
        result = await case_sync_service.preview_sync_iteration(
            gitlab_project_id=gl_project_id,
            testmo_project_id=payload.testmo_project_id or resolve_testmo_project_id(payload.project_id) or settings.testmo_project_id,
            iteration_name=payload.iteration_name,
            logical_project_id=payload.project_id,
            label=payload.label,
            root_folder_id=root_folder_id,
            gitlab_status=payload.gitlab_status,
            version_prod=payload.version_prod,
            run_name=payload.run_name,
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(
                status_code=502,
                detail="GitLab authentication failed: the token is invalid or expired. Please check your GITLAB_TOKEN in backend_py/.env",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail=f"GitLab API error: HTTP {exc.response.status_code}",
        ) from exc

    # Map to frontend-compatible format
    parent_name, child_name = _parse_folder_hierarchy(payload.iteration_name)
    issues = []
    to_create = to_update = to_skip = 0
    for d in result.details:
        # Skip error entries (not real issues)
        if "error" in d:
            issues.append({
                "iid": None,
                "url": "",
                "title": d["error"],
                "status": "error",
            })
            to_skip += 1
            continue
        action = d.get("action")
        if action == "create":
            frontend_status = "create"
            to_create += 1
        elif action == "update":
            frontend_status = "update"
            to_update += 1
        else:
            frontend_status = "skip"
            to_skip += 1
        issues.append({
            "iid": d.get("iid"),
            "url": d.get("url", ""),
            "title": d.get("title", ""),
            "status": frontend_status,
        })

    data = {
        "iteration": {"name": payload.iteration_name, "id": None},
        "folder": {
            "parent": parent_name,
            "child": child_name,
            "exists": result.folder_id is not None,
        },
        "issues": issues,
        "summary": {
            "toCreate": to_create,
            "toUpdate": to_update,
            "toSkip": to_skip,
            "total": len(issues),
        },
        "target_folder": {
            "id": result.folder_id,
            "name": result.folder_name,
        },
    }
    return {"success": True, "data": data}


@router.post("/cases/execute")
async def sync_cases_execute(request: Request, payload: SyncCasesExecutePayload, db: DBMain) -> StreamingResponse:
    gl_project_id = resolve_gitlab_project_id(payload.project_id)
    if not gl_project_id:
        async def _error_generator() -> AsyncGenerator[str, None]:
            yield f"data: {json.dumps({'level': 'error', 'message': f'Project {payload.project_id} not configured'})}\n\n"
        return StreamingResponse(_error_generator(), media_type="text/event-stream")

    async def event_generator() -> AsyncGenerator[str, None]:
        yield f"data: {json.dumps({'level': 'info', 'message': f'Starting case sync for iteration {payload.iteration_name}'})}\n\n"

        project_cfg = get_sync_project(payload.project_id)
        root_folder_id = project_cfg["testmo"]["rootFolderId"] if project_cfg else payload.root_folder_id

        result = await case_sync_service.sync_iteration(
            gitlab_project_id=gl_project_id,
            testmo_project_id=payload.testmo_project_id or resolve_testmo_project_id(payload.project_id) or settings.testmo_project_id,
            iteration_name=payload.iteration_name,
            logical_project_id=payload.project_id,
            label=payload.label,
            root_folder_id=root_folder_id,
            dry_run=payload.dry_run,
            gitlab_status=payload.gitlab_status,
            version_prod=payload.version_prod,
            run_name=payload.run_name,
        )

        # Stream per-issue log events
        for detail in result.details:
            if await request.is_disconnected():
                logger.info("Case sync SSE disconnected")
                break
            action = detail.get("action", "info")
            msg = detail.get("error") or f"{action.upper()}: {detail.get('title', '')}"
            yield f"data: {json.dumps({'level': 'debug', 'message': msg})}\n\n"

        # Summary event
        yield f"data: {json.dumps({
            'level': 'summary',
            'created': result.created,
            'updated': result.updated,
            'skipped': result.skipped,
            'enriched': 0,
            'errors': result.errors,
            'total_issues': len(result.details),
            'testmo_run_id': None,
            'testmo_run_url': None,
        })}\n\n"

        # Persist to DB after stream ends
        if not payload.dry_run:
            try:
                await case_sync_service.persist_case_run(
                    db,
                    project_id=payload.project_id,
                    iteration_name=payload.iteration_name,
                    folder_id=result.folder_id,
                    result=result,
                )
            except Exception as exc:
                logger.error("Failed to persist case sync run", extra={"error": str(exc)})
        yield f"data: {json.dumps({'level': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/cases/history")
async def sync_cases_history(db: DBMain) -> dict[str, Any]:
    history = await case_sync_service.get_history(db)
    return {"success": True, "data": history}


@router.post("/test-api", dependencies=[Depends(require_admin_token)])
async def test_api():
    return {"status": "ok"}
