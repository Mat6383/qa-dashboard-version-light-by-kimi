from typing import Any

from app.services.testmo import testmo_service

from app.routers.trpc._common import _result


async def _cache_clear(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    testmo_service.clear_cache()
    return _result({"success": True, "message": "Cache cleared successfully"})
