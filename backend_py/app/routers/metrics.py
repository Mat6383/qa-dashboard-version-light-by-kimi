"""Custom business metrics (not Prometheus scrape)."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import func, select

from app.database import get_main_db
from app.models.audit import AuditLog
from app.models.feature_flags import FeatureFlag
from app.models.sync_history import SyncRun
from app.models.users import User
from app.services.testmo import testmo_service

router = APIRouter()


@router.get("/")
async def custom_metrics():
    async with get_main_db() as db:
        # User counts
        total_users = await db.execute(select(func.count(User.id)))
        user_count = total_users.scalar() or 0

        # Sync runs today
        from datetime import date
        today = date.today().isoformat()
        sync_count = await db.execute(
            select(func.count(SyncRun.id)).where(SyncRun.executed_at >= today)
        )
        sync_today = sync_count.scalar() or 0

        # Audit actions today
        audit_count = await db.execute(
            select(func.count(AuditLog.id)).where(AuditLog.timestamp >= today)
        )
        audit_today = audit_count.scalar() or 0

        # Feature flags
        flags_result = await db.execute(select(FeatureFlag))
        flags = flags_result.scalars().all()
        enabled_flags = sum(1 for f in flags if f.enabled)

    # Testmo health
    testmo_healthy = await testmo_service.health_check()

    return {
        "metrics": {
            "users_total": user_count,
            "sync_runs_today": sync_today,
            "audit_actions_today": audit_today,
            "feature_flags_total": len(flags),
            "feature_flags_enabled": enabled_flags,
            "testmo_healthy": testmo_healthy,
        }
    }
