from typing import Any

from app.services.testmo import testmo_service

from app.routers.trpc._common import _result


async def _projects_list(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    projects = await testmo_service.get_projects()
    return _result(projects)
