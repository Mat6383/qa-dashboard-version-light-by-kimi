from typing import Any, cast

from app.config import settings
from app.services.case_sync import case_sync_service
from app.services.sync import sync_service
from app.utils.logger import get_logger

from app.routers.trpc._common import _result

logger = get_logger(__name__)


async def _sync_update_auto_config(input_data: dict[str, Any], db) -> dict[str, Any]:
    updated = await sync_service.update_auto_config(input_data)
    return _result({"config": updated})


async def _sync_preview_cases(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await case_sync_service.preview_sync_iteration(
        gitlab_project_id=cast(int, input_data.get("projectId")),
        testmo_project_id=input_data.get("testmoProjectId") or settings.testmo_project_id,
        iteration_name=cast(str, input_data.get("iterationName")),
        label=cast(str, input_data.get("label", "Test::TODO")),
        root_folder_id=cast(int, input_data.get("rootFolderId", 4514)),
    )
    return _result(result.to_dict())


async def _sync_execute_cases(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await case_sync_service.sync_iteration(
        gitlab_project_id=cast(int, input_data.get("projectId")),
        testmo_project_id=input_data.get("testmoProjectId") or settings.testmo_project_id,
        iteration_name=cast(str, input_data.get("iterationName")),
        label=cast(str, input_data.get("label", "Test::TODO")),
        root_folder_id=cast(int, input_data.get("rootFolderId", 4514)),
        dry_run=bool(input_data.get("dryRun", False)),
    )
    if not bool(input_data.get("dryRun", False)):
        try:
            await case_sync_service.persist_case_run(
                db,
                project_id=cast(int, input_data.get("projectId")),
                iteration_name=cast(str, input_data.get("iterationName")),
                folder_id=None,
                result=result,
            )
        except Exception as exc:
            logger.error("Failed to persist case sync run", extra={"error": str(exc)})
    return _result(result.to_dict())


async def _sync_cases_history(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    history = await case_sync_service.get_history(db)
    return _result(history)
