"""PDF generation via Playwright."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.deps import require_auth
from app.schemas import PdfPayload
from app.services.pdf import pdf_service

router = APIRouter()


@router.post("/generate")
async def generate_pdf(payload: PdfPayload, user=Depends(require_auth)):
    pdf_bytes = await pdf_service.generate_dashboard_pdf(payload.model_dump())
    filename = payload.filename or "dashboard.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
