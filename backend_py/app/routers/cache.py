"""Clear external API caches."""

from fastapi import APIRouter, Depends

from app.deps import require_admin_token
from app.services.testmo import testmo_service

router = APIRouter()


@router.post("/clear", dependencies=[Depends(require_admin_token)])
async def clear_cache():
    testmo_service.clear_cache()
    return {"status": "cleared"}
