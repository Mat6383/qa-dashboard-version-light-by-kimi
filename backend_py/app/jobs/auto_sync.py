"""Auto sync job : GitLab → Testmo (cases or automation runs)."""

from __future__ import annotations

import warnings

from app.config import settings
from app.database import get_main_db
from app.services.case_sync import case_sync_service
from app.services.sync import sync_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def auto_sync_job() -> None:
    config = await sync_service.get_auto_config()
    if not config.get("enabled"):
        return

    mode = config.get("mode", "cases")
    project_id = config.get("gitlab_project_id") or settings.gitlab_project_id
    testmo_project_id = config.get("testmo_project_id") or settings.testmo_project_id
    iteration_name = config.get("iteration_name")
    run_id = config.get("run_id")
    version = config.get("version")

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
            "mode": mode,
        },
    )

    if mode == "cases":
        try:
            result = await case_sync_service.sync_iteration(
                gitlab_project_id=int(project_id),
                testmo_project_id=int(testmo_project_id),
                iteration_name=iteration_name,
                dry_run=False,
            )
            logger.info(
                "Auto case sync complete",
                extra={
                    "created": result.created,
                    "updated": result.updated,
                    "skipped": result.skipped,
                    "errors": result.errors,
                },
            )
            async with get_main_db() as db:
                await case_sync_service.persist_case_run(
                    db,
                    project_id=int(project_id),
                    iteration_name=iteration_name,
                    folder_id=None,
                    result=result,
                )
        except Exception as exc:
            logger.error("Auto case sync job failed", extra={"error": str(exc)})

    elif mode == "automation":
        warnings.warn(
            "Automation run sync is deprecated, prefer case sync",
            DeprecationWarning,
            stacklevel=2,
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
    else:
        logger.warning("Unknown auto-sync mode", extra={"mode": mode})
