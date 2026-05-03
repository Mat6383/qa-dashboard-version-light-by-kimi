"""Weekly retention & archiving job."""

from __future__ import annotations

from app.database import get_main_db
from app.services.retention import retention_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def retention_job() -> None:
    """Run retention cycle for all configured policies."""
    try:
        async with get_main_db() as db:
            result = await retention_service.run_retention_cycle(db)
        logger.info("Retention job: archived=%s deleted=%s", result["archived"], result["deleted"])
    except Exception as exc:
        logger.error("Retention job failed: %s", exc)
