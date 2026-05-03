"""Feature flags (public read + admin CRUD)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.deps import DBMain, require_admin
from app.models.feature_flags import FeatureFlag
from app.schemas import FeatureFlagCreate, FeatureFlagOut, FeatureFlagUpdate

router = APIRouter()


@router.get("/")
async def list_flags(db: DBMain):
    result = await db.execute(select(FeatureFlag))
    rows = result.scalars().all()
    return {"flags": [FeatureFlagOut.model_validate(r) for r in rows]}


@router.get("/{key}")
async def get_flag(key: str, db: DBMain):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Flag not found")
    return FeatureFlagOut.model_validate(row)


@router.get("/admin", dependencies=[Depends(require_admin)])
async def list_admin_flags(db: DBMain):
    result = await db.execute(select(FeatureFlag))
    rows = result.scalars().all()
    return {"flags": [FeatureFlagOut.model_validate(r) for r in rows]}


@router.post("/admin", dependencies=[Depends(require_admin)])
async def create_flag(payload: FeatureFlagCreate, db: DBMain):
    existing = await db.execute(select(FeatureFlag).where(FeatureFlag.key == payload.key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Flag already exists")
    flag = FeatureFlag(**payload.model_dump())
    db.add(flag)
    await db.commit()
    await db.refresh(flag)
    return {"status": "created", "flag": FeatureFlagOut.model_validate(flag)}


@router.put("/admin/{key}", dependencies=[Depends(require_admin)])
async def update_flag(key: str, payload: FeatureFlagUpdate, db: DBMain):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(flag, field, value)
    await db.commit()
    await db.refresh(flag)
    return {"status": "updated", "flag": FeatureFlagOut.model_validate(flag)}


@router.delete("/admin/{key}", dependencies=[Depends(require_admin)])
async def delete_flag(key: str, db: DBMain):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    await db.delete(flag)
    await db.commit()
    return {"status": "deleted"}
