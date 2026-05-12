from typing import Any

from app.services.analytics import analytics_service

from app.routers.trpc._common import _ok, _result


async def _analytics_list(input_data: dict[str, Any], db) -> dict[str, Any]:
    insights = await analytics_service.get_insights(
        db,
        project_id=input_data.get("projectId"),
        unread_only=input_data.get("unreadOnly", False),
        limit=input_data.get("limit", 50),
    )
    return _ok(insights)


async def _analytics_mark_read(input_data: dict[str, Any], db) -> dict[str, Any]:
    ok = await analytics_service.mark_as_read(db, input_data["id"])
    return _result({"success": ok})


async def _analytics_mark_all_read(input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    count = await analytics_service.mark_all_as_read(
        db, project_id=(input_data or {}).get("projectId")
    )
    return _result({"success": True, "count": count})


async def _analytics_analyze(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await analytics_service.analyze_project(db, input_data["projectId"])
    return _ok(result)
