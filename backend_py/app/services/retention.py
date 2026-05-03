"""Retention & archiving service."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsInsight
from app.models.audit import AuditLog
from app.models.retention import ArchivedSnapshot, RetentionPolicy
from app.models.sync_history import MetricSnapshot
from app.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_POLICIES = [
    ("metric_snapshot", 365, True, False),
    ("audit_log", 90, True, False),
    ("analytics_insight", 180, True, False),
    ("sync_run", 90, True, False),
]


class RetentionService:
    """Manage retention policies and archive old data."""

    async def ensure_defaults(self, db: AsyncSession) -> None:
        for entity_type, days, auto_archive, auto_delete in DEFAULT_POLICIES:
            result = await db.execute(select(RetentionPolicy).where(RetentionPolicy.entity_type == entity_type))
            if not result.scalar_one_or_none():
                db.add(RetentionPolicy(
                    entity_type=entity_type,
                    retention_days=days,
                    auto_archive=auto_archive,
                    auto_delete=auto_delete,
                ))
        await db.commit()

    async def get_policies(self, db: AsyncSession) -> list[dict[str, Any]]:
        result = await db.execute(select(RetentionPolicy))
        rows = result.scalars().all()
        return [_policy_to_dict(r) for r in rows]

    async def update_policy(
        self,
        db: AsyncSession,
        entity_type: str,
        retention_days: int | None = None,
        auto_archive: bool | None = None,
        auto_delete: bool | None = None,
    ) -> dict[str, Any] | None:
        result = await db.execute(select(RetentionPolicy).where(RetentionPolicy.entity_type == entity_type))
        policy = result.scalar_one_or_none()
        if not policy:
            policy = RetentionPolicy(entity_type=entity_type)
            db.add(policy)
        if retention_days is not None:
            policy.retention_days = retention_days
        if auto_archive is not None:
            policy.auto_archive = auto_archive
        if auto_delete is not None:
            policy.auto_delete = auto_delete
        await db.commit()
        await db.refresh(policy)
        return _policy_to_dict(policy)

    async def get_archives(
        self,
        db: AsyncSession,
        entity_type: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        stmt = select(ArchivedSnapshot).order_by(desc(ArchivedSnapshot.archived_at)).limit(limit)
        if entity_type:
            stmt = stmt.where(ArchivedSnapshot.entity_type == entity_type)
        result = await db.execute(stmt)
        rows = result.scalars().all()
        return [_archive_to_dict(r) for r in rows]

    async def run_retention_cycle(self, db: AsyncSession) -> dict[str, Any]:
        await self.ensure_defaults(db)
        total_archived = 0
        total_deleted = 0

        policies = await self.get_policies(db)
        for policy in policies:
            cutoff = datetime.now(timezone.utc) - timedelta(days=policy["retention_days"])
            if policy["auto_archive"]:
                archived, deleted = await self._process_entity(db, policy["entity_type"], cutoff, policy["auto_delete"])
                total_archived += archived
                total_deleted += deleted

        return {"archived": total_archived, "deleted": total_deleted}

    async def _process_entity(
        self,
        db: AsyncSession,
        entity_type: str,
        cutoff: datetime,
        auto_delete: bool,
    ) -> tuple[int, int]:
        archived = 0
        deleted = 0

        if entity_type == "metric_snapshot":
            stmt = select(MetricSnapshot).where(MetricSnapshot.timestamp < cutoff)
            result = await db.execute(stmt)
            rows = result.scalars().all()
            for row in rows:
                db.add(ArchivedSnapshot(
                    entity_type="metric_snapshot",
                    entity_id=str(row.id),
                    project_id=row.project_id,
                    data_json={
                        "pass_rate": row.pass_rate,
                        "blocked_rate": row.blocked_rate,
                        "escape_rate": row.escape_rate,
                        "timestamp": row.timestamp.isoformat() if row.timestamp else None,
                    },
                ))
                archived += 1
                if auto_delete:
                    await db.delete(row)
                    deleted += 1

        elif entity_type == "audit_log":
            stmt = select(AuditLog).where(AuditLog.timestamp < cutoff)
            result = await db.execute(stmt)
            rows = result.scalars().all()
            for row in rows:
                db.add(ArchivedSnapshot(
                    entity_type="audit_log",
                    entity_id=str(row.id),
                    data_json={"action": row.action, "actor_id": row.actor_id, "success": row.success},
                ))
                archived += 1
                if auto_delete:
                    await db.delete(row)
                    deleted += 1

        elif entity_type == "analytics_insight":
            stmt = select(AnalyticsInsight).where(AnalyticsInsight.created_at < cutoff)
            result = await db.execute(stmt)
            rows = result.scalars().all()
            for row in rows:
                db.add(ArchivedSnapshot(
                    entity_type="analytics_insight",
                    entity_id=str(row.id),
                    project_id=row.project_id,
                    data_json={"type": row.type, "title": row.title, "confidence": row.confidence},
                ))
                archived += 1
                if auto_delete:
                    await db.delete(row)
                    deleted += 1

        await db.commit()
        return archived, deleted


retention_service = RetentionService()


def _policy_to_dict(row: RetentionPolicy) -> dict[str, Any]:
    return {
        "entity_type": row.entity_type,
        "retention_days": row.retention_days,
        "auto_archive": row.auto_archive,
        "auto_delete": row.auto_delete,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _archive_to_dict(row: ArchivedSnapshot) -> dict[str, Any]:
    return {
        "id": row.id,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "project_id": row.project_id,
        "data": row.data_json,
        "archived_at": row.archived_at.isoformat() if row.archived_at else None,
    }
