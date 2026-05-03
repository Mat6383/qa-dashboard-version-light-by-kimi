"""Audit logs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.deps import DBMain, require_admin
from app.models.audit import AuditLog
from app.schemas import AuditLogListResponse, AuditLogOut

router = APIRouter()


@router.get("/", dependencies=[Depends(require_admin)])
async def get_audit_logs(
    db: DBMain,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: str | None = Query(None),
):
    stmt = select(AuditLog)
    count_stmt = select(func.count(AuditLog.id))
    if action:
        stmt = stmt.where(AuditLog.action == action)
        count_stmt = count_stmt.where(AuditLog.action == action)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    stmt = stmt.order_by(AuditLog.timestamp.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return {
        "success": True,
        "data": [AuditLogOut.model_validate(r) for r in rows],
        "total": total,
        "limit": page_size,
        "offset": (page - 1) * page_size,
    }
