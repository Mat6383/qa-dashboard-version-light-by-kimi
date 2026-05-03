"""Daily analytics insight generation job."""

from __future__ import annotations

from app.database import get_main_db
from app.services.analytics import analytics_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def analytics_job() -> None:
    """Generate insights for all projects with recent snapshots."""
    from sqlalchemy import select
    from app.models.sync_history import MetricSnapshot

    async with get_main_db() as db:
        result = await db.execute(select(MetricSnapshot.project_id).distinct())
        project_ids = [r[0] for r in result.all()]

    for project_id in project_ids:
        try:
            async with get_main_db() as db:
                result = await analytics_service.analyze_project(db, project_id)
            logger.info("Analytics job: project=%s insights=%s", project_id, result["insights_created"])
        except Exception as exc:
            logger.error("Analytics job failed for project %s: %s", project_id, exc)
