"""Closure reports (HTML + PPTX)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import DBMain, require_auth
from app.schemas import ReportPayload, ReportResponse
from app.services.report import report_service

router = APIRouter()


@router.post("/generate")
async def generate_report(payload: ReportPayload, db: DBMain, user=Depends(require_auth)):
    result = await report_service.generate(payload.model_dump())
    return {
        "success": True,
        "data": {
            "html": result.get("html"),
            "pptx_base64": result.get("pptx_base64"),
            "message": "Report generated successfully",
        },
    }
