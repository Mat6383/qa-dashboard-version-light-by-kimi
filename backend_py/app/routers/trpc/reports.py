from typing import Any

from app.services.report import report_service

from app.routers.trpc._common import _result


async def _reports_generate(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await report_service.generate(input_data)
    return _result(result)
