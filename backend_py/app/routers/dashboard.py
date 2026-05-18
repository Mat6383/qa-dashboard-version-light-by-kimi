"""Dashboard metrics, quality rates, trends, SSE stream."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.deps import DBMain
from app.services.testmo import testmo_service
from app.utils.api_helpers import SAFE_INTERNAL_ERROR
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


async def _safe_testmo_call(coro):
    """Wrap Testmo calls to return graceful HTTP errors."""
    try:
        return await coro
    except httpx.HTTPStatusError as exc:
        logger.warning("Testmo API error", extra={"status": exc.response.status_code})
        raise HTTPException(
            status_code=exc.response.status_code, detail="Testmo API error"
        ) from exc
    except Exception as exc:
        logger.error("Testmo unexpected error", extra={"error": str(exc)})
        raise HTTPException(status_code=503, detail="Testmo service unavailable") from exc


def _parse_csv_ints(value: str) -> list[int]:
    """Parse comma-separated integers from query params (e.g. '64,61')."""
    if not value:
        return []
    if len(value) > 2000:
        raise ValueError("Input too long")
    parts = value.split(",")
    if len(parts) > 100:
        raise ValueError("Too many values")
    result = []
    for x in parts:
        s = x.strip()
        if not s:
            continue
        try:
            result.append(int(s))
        except ValueError as exc:
            raise ValueError(f"Invalid integer: {s}") from exc
    return result


# ── Static routes first ─────────────────────────────────


MAX_MULTI_PROJECTS = 20


@router.get("/multi")
async def multi_project_dashboard(project_ids: list[int] = Query(default=[])):
    # Si aucun project_ids fourni, récupérer tous les projets depuis Testmo
    if not project_ids:
        try:
            all_projects = await testmo_service.get_projects()
            project_ids = [p["id"] for p in all_projects if "id" in p][:MAX_MULTI_PROJECTS]
        except Exception as exc:
            logger.warning("Failed to fetch projects for multi-dashboard: %s", exc)
            return {"projects": [], "metrics": []}
    else:
        if len(project_ids) > MAX_MULTI_PROJECTS:
            raise HTTPException(
                status_code=422,
                detail=f"Too many projects. Maximum is {MAX_MULTI_PROJECTS}.",
            )
    if not project_ids:
        return {"projects": [], "metrics": []}
    try:
        projects_data = await testmo_service.compare_projects(project_ids)
    except httpx.HTTPStatusError as exc:
        logger.warning("Testmo API error in multi", extra={"status": exc.response.status_code})
        return {"projects": project_ids, "metrics": []}
    return {"projects": project_ids, "metrics": projects_data}


@router.get("/compare")
async def compare_dashboard(project_ids: list[int] = Query(default=[])):
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
async def get_dashboard(
    project_id: int,
    db: DBMain,
    preprod_milestones_raw: str = Query(default="", alias="preprodMilestones"),
    prod_milestones_raw: str = Query(default="", alias="prodMilestones"),
):
    try:
        preprod = _parse_csv_ints(preprod_milestones_raw)
        prod = _parse_csv_ints(prod_milestones_raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    milestone_ids = list(set(preprod + prod)) if (preprod or prod) else None
    metrics = await _safe_testmo_call(
        testmo_service.get_project_metrics(project_id, milestone_ids=milestone_ids)
    )
    return {"project_id": project_id, **metrics}


@router.get("/{project_id}/quality-rates")
async def get_quality_rates(
    project_id: int,
    db: DBMain,
    preprod_milestones_raw: str = Query(default="", alias="preprodMilestones"),
    prod_milestones_raw: str = Query(default="", alias="prodMilestones"),
):
    try:
        preprod = _parse_csv_ints(preprod_milestones_raw)
        prod = _parse_csv_ints(prod_milestones_raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    rates = await _safe_testmo_call(
        testmo_service.get_escape_and_detection_rates(
            project_id, preprod_milestones=preprod, prod_milestones=prod
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
    from collections import defaultdict
    from datetime import datetime

    from sqlalchemy import select

    from app.models.sync_history import MetricSnapshot

    stmt = select(MetricSnapshot).where(MetricSnapshot.project_id == project_id)
    if from_date:
        stmt = stmt.where(MetricSnapshot.date >= from_date)
    if to_date:
        stmt = stmt.where(MetricSnapshot.date <= to_date)
    stmt = stmt.order_by(MetricSnapshot.date).limit(2000)
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

    if granularity in ("week", "month") and snapshots:
        groups: dict[str, list[dict]] = defaultdict(list)
        for s in snapshots:
            date = s["date"]
            if granularity == "week":
                d = datetime.strptime(date, "%Y-%m-%d")
                key = d.strftime("%Y-W%W")
            else:
                key = date[:7]
            groups[key].append(s)

        def _avg(field: str, group: list[dict]) -> float | None:
            vals = [g[field] for g in group if g[field] is not None]
            return round(sum(vals) / len(vals), 2) if vals else None

        snapshots = []
        for key in sorted(groups.keys()):
            group = groups[key]
            label = key + "-01" if granularity == "month" else group[0]["date"]
            snapshots.append(
                {
                    "date": label,
                    "pass_rate": _avg("pass_rate", group),
                    "completion_rate": _avg("completion_rate", group),
                    "escape_rate": _avg("escape_rate", group),
                    "detection_rate": _avg("detection_rate", group),
                    "blocked_rate": _avg("blocked_rate", group),
                    "total_tests": _avg("total_tests", group),
                }
            )

    return {"project_id": project_id, "granularity": granularity, "snapshots": snapshots}


SSE_MAX_DURATION = 300  # 5 minutes
SSE_TESTMO_TIMEOUT = 10  # seconds


@router.get("/{project_id}/stream")
async def stream_dashboard(request: Request, project_id: int):
    start = datetime.now(timezone.utc)

    async def event_generator() -> AsyncGenerator[str, None]:
        while True:
            if await request.is_disconnected():
                break
            if (datetime.now(timezone.utc) - start).total_seconds() > SSE_MAX_DURATION:
                break
            try:
                metrics = await asyncio.wait_for(
                    testmo_service.get_project_metrics(project_id), timeout=SSE_TESTMO_TIMEOUT
                )
                payload = json.dumps({"project_id": project_id, **metrics})
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                logger.warning("SSE stream timeout for project %s", project_id)
                yield f"data: {json.dumps({'error': 'Timeout fetching metrics'})}\n\n"
            except Exception:
                logger.error("SSE stream error", exc_info=True)
                yield f"data: {json.dumps({'error': SAFE_INTERNAL_ERROR})}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
