"""Auto sync job : GitLab → Testmo automation runs."""

from __future__ import annotations

from app.config import settings
from app.services.sync import sync_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def auto_sync_job() -> None:
    if not settings.sync_auto_enabled:
        return

    project_id = settings.sync_auto_gitlab_project_id or settings.gitlab_project_id
    iteration_name = settings.sync_auto_iteration_name
    run_id = settings.sync_auto_run_id
    version = settings.sync_auto_version

    if not project_id or not iteration_name:
        logger.warning("Auto-sync misconfigured: missing project_id or iteration_name")
        return

    logger.info(
        "Running auto sync job",
        extra={
            "project_id": project_id,
            "iteration_name": iteration_name,
            "run_id": run_id,
            "version": version,
        },
    )

    try:
        async for event in sync_service.execute_sync(
            project_id=project_id,
            iteration_name=iteration_name,
            run_id=run_id,
            version=version,
            dry_run=False,
            source="gitlab-sync-auto",
        ):
            level = event.get("level", "info")
            message = event.get("message", str(event))
            if level == "error":
                logger.error(message)
            elif level == "debug":
                logger.debug(message)
            else:
                logger.info(message)
    except Exception as exc:
        logger.error("Auto sync job failed", extra={"error": str(exc)})
