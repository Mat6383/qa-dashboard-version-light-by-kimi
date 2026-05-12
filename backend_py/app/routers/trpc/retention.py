from typing import Any

from app.services.retention import retention_service

from app.routers.trpc._common import _ok


async def _retention_policies(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    policies = await retention_service.get_policies(db)
    return _ok(policies)


async def _retention_update_policy(input_data: dict[str, Any], db) -> dict[str, Any]:
    policy = await retention_service.update_policy(
        db,
        input_data["entityType"],
        input_data.get("retentionDays"),
        input_data.get("autoArchive"),
        input_data.get("autoDelete"),
    )
    return _ok(policy)


async def _retention_archives(input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    archives = await retention_service.get_archives(
        db,
        entity_type=(input_data or {}).get("entityType"),
        limit=(input_data or {}).get("limit", 100),
    )
    return _ok(archives)


async def _retention_run_cycle(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    result = await retention_service.run_retention_cycle(db)
    return _ok(result)
