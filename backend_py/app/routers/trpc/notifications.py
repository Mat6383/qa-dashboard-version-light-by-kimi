from typing import Any

from sqlalchemy import select

from app.models.notifications import NotificationSetting
from app.services.alerting import alerting_service

from app.routers.trpc._common import _result


async def _notifications_settings(input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    project_id = (input_data or {}).get("projectId")
    stmt = select(NotificationSetting).where(NotificationSetting.project_id == project_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    return _result(
        {
            "id": row.id,
            "project_id": row.project_id,
            "email": row.email,
            "slack_webhook": row.slack_webhook,
            "teams_webhook": row.teams_webhook,
            "enabled_sla_email": row.enabled_sla_email,
            "enabled_sla_slack": row.enabled_sla_slack,
            "enabled_sla_teams": row.enabled_sla_teams,
        }
        if row
        else None
    )


async def _notifications_save_settings(input_data: dict[str, Any], db) -> dict[str, Any]:
    project_id = input_data.get("projectId")
    result = await db.execute(
        select(NotificationSetting).where(NotificationSetting.project_id == project_id)
    )
    setting = result.scalar_one_or_none()
    if setting:
        for field in [
            "email",
            "slack_webhook",
            "teams_webhook",
            "enabled_sla_email",
            "enabled_sla_slack",
            "enabled_sla_teams",
            "email_template",
            "slack_template",
            "teams_template",
        ]:
            if field in input_data:
                setattr(setting, field, input_data[field])
    else:
        setting = NotificationSetting(
            project_id=project_id,
            **{k: v for k, v in input_data.items() if k != "projectId"},
        )
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return _result({"id": setting.id, "project_id": setting.project_id})


async def _notifications_test_webhook(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await alerting_service.send_test(
        input_data.get("channel", "email"),
        input_data.get("url") or input_data.get("destination"),
    )
    return _result(result)
