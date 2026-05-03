"""Dashboard metrics, quality rates, trends, SSE stream."""

from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.deps import DBMain
from app.services.testmo import testmo_service
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


async def _safe_testmo_call(coro):
    """Wrap Testmo calls to return graceful HTTP errors."""
    try:
        return await coro
    except httpx.HTTPStatusError as exc:
        logger.warning("Testmo API error", extra={"status": exc.response.status_code})
        raise HTTPException(status_code=exc.response.status_code, detail="Testmo API error") from exc
    except Exception as exc:
        logger.error("Testmo unexpected error", extra={"error": str(exc)})
        raise HTTPException(status_code=503, detail="Testmo service unavailable") from exc


# ── Static routes first ─────────────────────────────────

@router.get("/multi")
async def multi_project_dashboard(project_ids: list[int] = Query(default=[]), db: DBMain = None):
    if not project_ids:
        return {"projects": [], "metrics": []}
    try:
        projects_data = await testmo_service.compare_projects(project_ids)
    except httpx.HTTPStatusError as exc:
        logger.warning("Testmo API error in multi", extra={"status": exc.response.status_code})
        return {"projects": project_ids, "metrics": []}
    return {"projects": project_ids, "metrics": projects_data}


@router.get("/compare")
async def compare_dashboard(project_ids: list[int] = Query(default=[]), db: DBMain = None):
    if not project_ids:
        return {"projects": []}
    try:
        comparison = await testmo_service.compare_projects(project_ids)
    except httpx.HTTPStatusError as exc:
        logger.warning("Testmo API error in compare", extra={"status": exc.response.status_code})
        return {"projects": []}
    return {"projects": comparison}


# ── Dynamic project routes ──────────────────────────────

@router.get("/{project_id}")
async def get_dashboard(project_id: int, db: DBMain):
    metrics = await _safe_testmo_call(testmo_service.get_project_metrics(project_id))
    return {"project_id": project_id, **metrics}


@router.get("/{project_id}/quality-rates")
async def get_quality_rates(
    project_id: int,
    db: DBMain,
    preprod_milestones: list[int] = Query(default=[]),
    prod_milestones: list[int] = Query(default=[]),
):
    rates = await _safe_testmo_call(
        testmo_service.get_escape_and_detection_rates(
            project_id, preprod_milestones=preprod_milestones, prod_milestones=prod_milestones
        )
    )
    return rates


@router.get("/{project_id}/annual-trends")
async def get_annual_trends(project_id: int, db: DBMain):
    trends = await _safe_testmo_call(testmo_service.get_annual_quality_trends(project_id))
    return {"success": True, "data": trends}


@router.get("/{project_id}/trends")
async def get_trends(
    project_id: int,
    db: DBMain,
    granularity: str = Query("daily"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
):
    from sqlalchemy import select
    from app.models.sync_history import MetricSnapshot

    stmt = select(MetricSnapshot).where(MetricSnapshot.project_id == project_id)
    if from_date:
        stmt = stmt.where(MetricSnapshot.date >= from_date)
    if to_date:
        stmt = stmt.where(MetricSnapshot.date <= to_date)
    stmt = stmt.order_by(MetricSnapshot.date)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    snapshots = [
        {
            "date": r.date,
            "pass_rate": r.pass_rate,
            "completion_rate": r.completion_rate,
            "escape_rate": r.escape_rate,
            "detection_rate": r.detection_rate,
            "blocked_rate": r.blocked_rate,
            "total_tests": r.total_tests,
        }
        for r in rows
    ]
    return {"project_id": project_id, "granularity": granularity, "snapshots": snapshots}


@router.get("/{project_id}/stream")
async def stream_dashboard(request: Request, project_id: int):
    async def event_generator() -> AsyncGenerator[str, None]:
        while True:
            if await request.is_disconnected():
                break
            try:
                metrics = await testmo_service.get_project_metrics(project_id)
                payload = json.dumps({"project_id": project_id, **metrics})
                yield f"data: {payload}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
