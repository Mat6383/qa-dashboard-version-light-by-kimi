"""CSV & Excel exports."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.deps import DBMain, require_auth
from app.schemas import ExportPayload
from app.services.export import export_service

router = APIRouter()


@router.post("/csv")
async def export_csv(payload: ExportPayload, db: DBMain, user=Depends(require_auth)):
    csv_bytes = await export_service.generate_csv(payload.model_dump())
    filename = payload.filename or "export.csv"
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/excel")
async def export_excel(payload: ExportPayload, db: DBMain, user=Depends(require_auth)):
    xlsx_bytes = await export_service.generate_excel(payload.model_dump())
    filename = payload.filename or "export.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
