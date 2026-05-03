"""Notification settings & active alerting."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.deps import DBMain, require_admin, require_auth
from app.models.notifications import NotificationSetting
from app.schemas import (
    NotificationSettingCreate,
    NotificationSettingOut,
    NotificationTestPayload,
)
from app.services.alerting import alerting_service

router = APIRouter()


@router.get("/settings")
async def get_settings(db: DBMain, user=Depends(require_auth)):
    result = await db.execute(select(NotificationSetting).where(NotificationSetting.project_id.is_(None)))
    row = result.scalar_one_or_none()
    return {"settings": NotificationSettingOut.model_validate(row) if row else None}


@router.get("/settings/{project_id}")
async def get_project_settings(project_id: int, db: DBMain, user=Depends(require_auth)):
    result = await db.execute(select(NotificationSetting).where(NotificationSetting.project_id == project_id))
    row = result.scalar_one_or_none()
    return {"settings": NotificationSettingOut.model_validate(row) if row else None}


@router.put("/settings")
async def update_settings(payload: NotificationSettingCreate, db: DBMain, admin=Depends(require_admin)):
    # Upsert by project_id (None = global)
    result = await db.execute(
        select(NotificationSetting).where(NotificationSetting.project_id == payload.project_id)
    )
    setting = result.scalar_one_or_none()
    if setting:
        for field, value in payload.model_dump().items():
            setattr(setting, field, value)
    else:
        setting = NotificationSetting(**payload.model_dump())
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return {"status": "updated", "setting": NotificationSettingOut.model_validate(setting)}


@router.post("/test")
async def test_notification(payload: NotificationTestPayload, db: DBMain, admin=Depends(require_admin)):
    result = await alerting_service.send_test(payload.channel, payload.destination)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Send failed"))
    return result
