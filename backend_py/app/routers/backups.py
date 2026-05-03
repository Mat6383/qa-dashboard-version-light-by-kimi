"""Trigger & list SQLite backups."""

from fastapi import APIRouter, Depends

from app.deps import require_admin_token
from app.services.backup import backup_service

router = APIRouter()


@router.get("/", dependencies=[Depends(require_admin_token)])
async def list_backups():
    return {"backups": backup_service.list_local()}


@router.post("/", dependencies=[Depends(require_admin_token)])
async def trigger_backup():
    result = await backup_service.run_backup()
    return {"status": "started", "result": result}
