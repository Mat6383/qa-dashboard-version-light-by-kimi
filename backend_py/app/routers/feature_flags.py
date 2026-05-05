"""Feature flags (public read + admin CRUD)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select

from app.deps import DBMain, require_admin_or_token
from app.models.feature_flags import FeatureFlag
from app.schemas import FeatureFlagCreate, FeatureFlagOut, FeatureFlagUpdate

router = APIRouter()

T = TypeVar("T")


def _body_model(model_cls: type[T]):
    """Parse JSON or form-encoded body into a Pydantic model."""
    async def _parse(request: Request) -> T:
        ct = request.headers.get("content-type", "")
        if "application/json" in ct:
            data = await request.json()
        else:
            form = await request.form()
            data = dict(form)
            # Coerce numeric strings to float/int where expected
            # Map field names by alias so camelCase form keys work
            fields_by_alias: dict[str, str] = {}
            for name, info in model_cls.model_fields.items():
                alias = info.alias or name
                fields_by_alias[alias] = name
                fields_by_alias[name] = name

            for key, val in list(data.items()):
                field_name = fields_by_alias.get(key, key)
                field_info = model_cls.model_fields.get(field_name)
                if field_info is None:
                    continue
                annotation = field_info.annotation
                if annotation in (float, "float") or (
                    hasattr(annotation, "__origin__") and getattr(annotation, "__origin__", None) is float
                ):
                    try:
                        data[key] = float(val)  # type: ignore[arg-type]
                    except ValueError:
                        pass
                elif annotation in (int, "int") or (
                    hasattr(annotation, "__origin__") and getattr(annotation, "__origin__", None) is int
                ):
                    try:
                        data[key] = int(val)  # type: ignore[arg-type]
                    except ValueError:
                        pass
        return model_cls.model_validate(data)

    return _parse


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/")
async def list_flags(db: DBMain):
    result = await db.execute(select(FeatureFlag))
    rows = result.scalars().all()
    data: dict[str, bool] = {}
    for row in rows:
        data[row.key] = row.enabled
    return {"success": True, "data": data, "timestamp": _now()}


@router.get("/admin", dependencies=[Depends(require_admin_or_token)])
async def list_admin_flags(db: DBMain):
    result = await db.execute(select(FeatureFlag))
    rows = result.scalars().all()
    return {
        "success": True,
        "data": [FeatureFlagOut.model_validate(r).model_dump(by_alias=True) for r in rows],
        "timestamp": _now(),
    }


@router.get("/{key}")
async def get_flag(key: str, db: DBMain):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Flag not found")
    return {
        "success": True,
        "data": {
            "key": row.key,
            "enabled": row.enabled,
            "rolloutPercentage": row.rollout_percentage,
        },
        "timestamp": _now(),
    }


@router.post("/admin", dependencies=[Depends(require_admin_or_token)])
async def create_flag(
    payload: Annotated[FeatureFlagCreate, Depends(_body_model(FeatureFlagCreate))], db: DBMain
):
    existing = await db.execute(select(FeatureFlag).where(FeatureFlag.key == payload.key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Flag already exists")
    flag = FeatureFlag(**payload.model_dump())
    db.add(flag)
    await db.commit()
    await db.refresh(flag)
    return {
        "success": True,
        "data": FeatureFlagOut.model_validate(flag).model_dump(by_alias=True),
        "timestamp": _now(),
    }


@router.put("/admin/{key}", dependencies=[Depends(require_admin_or_token)])
async def update_flag(
    key: str, payload: Annotated[FeatureFlagUpdate, Depends(_body_model(FeatureFlagUpdate))], db: DBMain
):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(flag, field, value)
    await db.commit()
    await db.refresh(flag)
    return {
        "success": True,
        "data": FeatureFlagOut.model_validate(flag).model_dump(by_alias=True),
        "timestamp": _now(),
    }


@router.delete("/admin/{key}", dependencies=[Depends(require_admin_or_token)])
async def delete_flag(key: str, db: DBMain):
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    await db.delete(flag)
    await db.commit()
    return {"success": True, "deleted": True, "timestamp": _now()}
