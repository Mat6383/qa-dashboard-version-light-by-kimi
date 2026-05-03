"""Analytics insights router."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import DBMain, require_admin
from app.schemas import (
    AnalyticsAnalyzePayload,
    AnalyticsInsightOut,
    AnalyticsListResponse,
    AnalyticsMarkReadPayload,
)
from app.services.analytics import analytics_service

router = APIRouter()


@router.get("/", dependencies=[Depends(require_admin)])
async def list_insights(
    project_id: int | None = None,
    unread_only: bool = False,
    limit: int = 50,
    db: DBMain = None,
) -> AnalyticsListResponse:
    insights = await analytics_service.get_insights(db, project_id, unread_only, limit)
    return AnalyticsListResponse(insights=[AnalyticsInsightOut.model_validate(i) for i in insights])


@router.post("/mark-read", dependencies=[Depends(require_admin)])
async def mark_read(payload: AnalyticsMarkReadPayload, db: DBMain = None) -> dict:
    ok = await analytics_service.mark_as_read(db, payload.id)
    return {"success": ok}


@router.post("/mark-all-read", dependencies=[Depends(require_admin)])
async def mark_all_read(project_id: int | None = None, db: DBMain = None) -> dict:
    count = await analytics_service.mark_all_as_read(db, project_id)
    return {"success": True, "count": count}


@router.post("/analyze", dependencies=[Depends(require_admin)])
async def analyze(payload: AnalyticsAnalyzePayload, db: DBMain = None) -> dict:
    result = await analytics_service.analyze_project(db, payload.project_id)
    return result
