"""Daily metrics snapshot job."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from app.database import get_main_db
from app.models.sync_history import MetricSnapshot
from app.services.testmo import testmo_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def metrics_snapshot_job() -> None:
    """Collect metrics for all projects and persist snapshots."""
    logger.info("Running metrics snapshot job")
    projects = await testmo_service.get_projects()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    async with get_main_db() as db:
        for project in projects:
            pid = project.get("id")
            name = project.get("name", "unknown")
            if not pid:
                continue
            try:
                metrics = await testmo_service.get_project_metrics(pid)
                raw = metrics.get("raw", {})

                # Upsert metric snapshot for today
                stmt = select(MetricSnapshot).where(
                    MetricSnapshot.project_id == pid,
                    MetricSnapshot.date == today,
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.pass_rate = metrics.get("passRate")
                    existing.completion_rate = metrics.get("completionRate")
                    existing.blocked_rate = metrics.get("blockedRate")
                    existing.total_tests = raw.get("total")
                    existing.escape_rate = None
                    existing.detection_rate = None
                    logger.info(f"[MetricsSnapshot] Updated snapshot for project {name} ({pid})")
                else:
                    snapshot = MetricSnapshot(
                        project_id=pid,
                        date=today,
                        pass_rate=metrics.get("passRate"),
                        completion_rate=metrics.get("completionRate"),
                        blocked_rate=metrics.get("blockedRate"),
                        total_tests=raw.get("total"),
                        escape_rate=None,
                        detection_rate=None,
                    )
                    db.add(snapshot)
                    logger.info(f"[MetricsSnapshot] Created snapshot for project {name} ({pid})")
            except Exception as exc:
                logger.warning(f"[MetricsSnapshot] Failed snapshot for project {name} ({pid}): {exc}")

    logger.info("Metrics snapshot job completed")
