"""Feedback sync cron job — scan Testmo runs every 30 min."""

from __future__ import annotations

from app.database import get_main_db
from app.projects_config import SYNC_PROJECTS
from app.services.feedback_sync import feedback_sync_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def feedback_sync_job() -> None:
    """Scan all configured projects for filled Testmo feedback notes."""
    logger.info("[FeedbackSyncJob] Starting cron scan")

    for project in SYNC_PROJECTS:
        if not project.get("configured"):
            continue

        testmo_project_id = project.get("testmo", {}).get("projectId")
        gitlab_project_id = project.get("gitlab", {}).get("projectId")

        if not testmo_project_id or not gitlab_project_id:
            logger.debug("[FeedbackSyncJob] Skipping unconfigured project %s", project.get("id"))
            continue

        try:
            async with get_main_db() as db:
                summary = await feedback_sync_service.scan_project(
                    testmo_project_id=int(testmo_project_id),
                    gitlab_project_id=int(gitlab_project_id),
                    active_only=True,
                    triggered_by="cron",
                    db=db,
                )
            logger.info(
                "[FeedbackSyncJob] Project %s done — created=%s skipped=%s errors=%s",
                project.get("id"),
                summary.get("tickets_created", 0),
                summary.get("tickets_skipped", 0),
                summary.get("errors", 0),
            )
        except Exception as exc:
            logger.error(
                "[FeedbackSyncJob] Project %s scan failed: %s",
                project.get("id"),
                exc,
            )

    logger.info("[FeedbackSyncJob] Cron scan complete")
