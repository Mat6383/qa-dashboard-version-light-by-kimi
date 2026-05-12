from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from app.models.integrations import Integration
from app.services.gitlab_connector import gitlab_connector_service
from app.services.jira import integration_service

from app.routers.trpc._common import _err, _ok, _result


async def _integrations_list(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    result = await db.execute(select(Integration))
    rows = result.scalars().all()
    return _ok(
        [
            {"id": r.id, "name": r.name, "type": r.type, "config": r.config_json, "enabled": r.enabled}
            for r in rows
        ]
    )


async def _integrations_get(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    return _ok(
        {"id": row.id, "name": row.name, "type": row.type, "config": row.config_json, "enabled": row.enabled}
    )


async def _integrations_create(input_data: dict[str, Any], db) -> dict[str, Any]:
    integration = Integration(
        name=input_data["name"],
        type=input_data["type"],
        config_json=input_data.get("config", {}),
        enabled=input_data.get("enabled", True),
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return _ok(
        {"id": integration.id, "name": integration.name, "type": integration.type, "config": integration.config_json, "enabled": integration.enabled}
    )


async def _integrations_update(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if "name" in input_data:
        row.name = input_data["name"]
    if "type" in input_data:
        row.type = input_data["type"]
    if "config" in input_data:
        row.config_json = input_data["config"]
    if "enabled" in input_data:
        row.enabled = input_data["enabled"]
    await db.commit()
    await db.refresh(row)
    return _ok(
        {"id": row.id, "name": row.name, "type": row.type, "config": row.config_json, "enabled": row.enabled}
    )


async def _integrations_delete(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    await db.delete(row)
    await db.commit()
    return _result({"success": True})


async def _integrations_test(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if row.type == "jira":
        resp = await integration_service.test_jira_connection(row.config_json)
    elif row.type == "gitlab":
        resp = await integration_service.test_gitlab_connection(row.config_json)
    elif row.type == "generic_webhook":
        resp = await integration_service.send_generic_webhook(
            row.config_json, {"event": "test", "timestamp": datetime.now(timezone.utc).isoformat()}
        )
    else:
        return _err("Type not supported for test")
    return _ok(resp)


async def _integrations_create_jira_issue(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if row.type != "jira":
        return _err("Integration is not Jira", "BAD_REQUEST")
    resp = await integration_service.create_jira_issue(
        row.config_json,
        input_data["summary"],
        input_data["description"],
        input_data.get("issueType", "Bug"),
    )
    if resp.get("success"):
        row.last_sync_at = datetime.now(timezone.utc)
        await db.commit()
    return _ok(resp)


async def _integrations_gitlab_projects(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if row.type != "gitlab":
        return _err("Integration is not GitLab", "BAD_REQUEST")
    projects = await gitlab_connector_service.list_projects(row.config_json)
    return _result({"projects": projects})


async def _integrations_gitlab_issues(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if row.type != "gitlab":
        return _err("Integration is not GitLab", "BAD_REQUEST")
    issues = await gitlab_connector_service.list_issues(row.config_json, input_data.get("projectId"))
    return _result({"issues": issues})
