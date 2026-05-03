"""Analytics insights service — pattern detection on metrics history."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsInsight
from app.models.sync_history import MetricSnapshot
from app.utils.logger import get_logger

logger = get_logger(__name__)


class AnalyticsService:
    """Detect anomalies and generate insights from historical metrics."""

    async def get_insights(
        self,
        db: AsyncSession,
        project_id: int | None = None,
        unread_only: bool = False,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        stmt = select(AnalyticsInsight).order_by(desc(AnalyticsInsight.created_at))
        if project_id is not None:
            stmt = stmt.where(AnalyticsInsight.project_id == project_id)
        if unread_only:
            stmt = stmt.where(AnalyticsInsight.read.is_(False))
        stmt = stmt.limit(limit)
        result = await db.execute(stmt)
        rows = result.scalars().all()
        return [_insight_to_dict(r) for r in rows]

    async def mark_as_read(self, db: AsyncSession, insight_id: int) -> bool:
        result = await db.execute(select(AnalyticsInsight).where(AnalyticsInsight.id == insight_id))
        row = result.scalar_one_or_none()
        if not row:
            return False
        row.read = True
        await db.commit()
        return True

    async def mark_all_as_read(self, db: AsyncSession, project_id: int | None = None) -> int:
        stmt = select(AnalyticsInsight).where(AnalyticsInsight.read.is_(False))
        if project_id is not None:
            stmt = stmt.where(AnalyticsInsight.project_id == project_id)
        result = await db.execute(stmt)
        rows = result.scalars().all()
        for row in rows:
            row.read = True
        await db.commit()
        return len(rows)

    async def analyze_project(self, db: AsyncSession, project_id: int) -> dict[str, Any]:
        """Run all heuristics and persist new insights."""
        insights_created = 0

        # Fetch last 30 days of snapshots
        since = datetime.now(timezone.utc) - timedelta(days=30)
        stmt = (
            select(MetricSnapshot)
            .where(
                MetricSnapshot.project_id == project_id,
                MetricSnapshot.timestamp >= since,
            )
            .order_by(MetricSnapshot.timestamp)
        )
        result = await db.execute(stmt)
        snapshots = result.scalars().all()

        if len(snapshots) < 3:
            return {"project_id": project_id, "insights_created": 0, "message": "Not enough data"}

        rates = [s.pass_rate for s in snapshots if s.pass_rate is not None]
        blocked = [s.blocked_rate for s in snapshots if s.blocked_rate is not None]
        escapes = [s.escape_rate for s in snapshots if s.escape_rate is not None]

        # Heuristic 1: pass rate drop > 10 pts
        if len(rates) >= 2 and (rates[-2] - rates[-1]) > 10:
            await self._add_insight(
                db, project_id, "pass_rate_drop",
                "Pass Rate Drop Detected",
                f"Pass rate fell from {rates[-2]:.1f}% to {rates[-1]:.1f}%.",
                0.9, {"previous": rates[-2], "current": rates[-1]}
            )
            insights_created += 1

        # Heuristic 2: stagnation (std dev < 2 over last 7 snapshots)
        if len(rates) >= 7:
            recent = rates[-7:]
            mean = sum(recent) / len(recent)
            variance = sum((x - mean) ** 2 for x in recent) / len(recent)
            if variance ** 0.5 < 2:
                await self._add_insight(
                    db, project_id, "stagnation",
                    "Metrics Stagnation",
                    f"Pass rate has been flat around {mean:.1f}% for the last 7 snapshots.",
                    0.7, {"mean": mean}
                )
                insights_created += 1

        # Heuristic 3: high blocked rate > 20%
        if blocked and blocked[-1] > 20:
            await self._add_insight(
                db, project_id, "blocked",
                "High Blocked Rate",
                f"Blocked rate is {blocked[-1]:.1f}%.",
                0.85, {"blocked_rate": blocked[-1]}
            )
            insights_created += 1

        # Heuristic 4: escape rate spike > 5%
        if escapes and escapes[-1] > 5:
            await self._add_insight(
                db, project_id, "escape",
                "Escape Rate Spike",
                f"Escape rate rose to {escapes[-1]:.1f}%.",
                0.8, {"escape_rate": escapes[-1]}
            )
            insights_created += 1

        await db.commit()
        return {
            "project_id": project_id,
            "insights_created": insights_created,
            "snapshots_analyzed": len(snapshots),
        }

    async def _add_insight(
        self,
        db: AsyncSession,
        project_id: int,
        insight_type: str,
        title: str,
        message: str,
        confidence: float,
        data: dict[str, Any],
    ) -> None:
        # Deduplicate: same project+type within 24h
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        stmt = select(AnalyticsInsight).where(
            AnalyticsInsight.project_id == project_id,
            AnalyticsInsight.type == insight_type,
            AnalyticsInsight.created_at >= since,
        )
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            return
        db.add(AnalyticsInsight(
            project_id=project_id,
            type=insight_type,
            title=title,
            message=message,
            confidence=confidence,
            data_json=data,
        ))
        await db.flush()


analytics_service = AnalyticsService()


def _insight_to_dict(row: AnalyticsInsight) -> dict[str, Any]:
    return {
        "id": row.id,
        "project_id": row.project_id,
        "type": row.type,
        "title": row.title,
        "message": row.message,
        "confidence": row.confidence,
        "data": row.data_json,
        "read": row.read,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
