"""Scheduled backup job wrapper."""

from __future__ import annotations

from app.services.backup import backup_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def backup_job() -> None:
    logger.info("Running scheduled backup")
    result = await backup_service.run_backup()
    logger.info("Backup completed", extra={"result": result})
