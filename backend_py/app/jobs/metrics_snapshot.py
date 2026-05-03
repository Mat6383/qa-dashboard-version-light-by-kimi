"""Daily metrics snapshot job."""

from __future__ import annotations

from app.services.testmo import testmo_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def metrics_snapshot_job() -> None:
    logger.info("Running metrics snapshot job")
    projects = await testmo_service.get_projects()
    for project in projects:
        pid = project.get("id")
        if pid:
            # TODO: compute metrics and save to DB
            pass
