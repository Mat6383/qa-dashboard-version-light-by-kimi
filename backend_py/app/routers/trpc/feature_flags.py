from typing import Any

from sqlalchemy import select

from app.models.feature_flags import FeatureFlag

from app.routers.trpc._common import _err, _ok, _result


async def _feature_flags_list(input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag))
    rows = result.scalars().all()
    return _result(
        {
            "flags": [
                {"key": r.key, "enabled": r.enabled, "rolloutPercentage": r.rollout_percentage}
                for r in rows
            ]
        }
    )


async def _feature_flags_get(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == input_data["key"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Flag not found", "NOT_FOUND")
    return _result(
        {
            "flag": {
                "key": row.key,
                "enabled": row.enabled,
                "rolloutPercentage": row.rollout_percentage,
                "description": row.description,
            }
        }
    )


async def _feature_flags_list_admin(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag))
    rows = result.scalars().all()
    return _result(
        {
            "flags": [
                {
                    "key": r.key,
                    "enabled": r.enabled,
                    "description": r.description,
                    "rolloutPercentage": r.rollout_percentage,
                }
                for r in rows
            ]
        }
    )


async def _feature_flags_create(input_data: dict[str, Any], db) -> dict[str, Any]:
    existing = await db.execute(select(FeatureFlag).where(FeatureFlag.key == input_data["key"]))
    if existing.scalar_one_or_none():
        return _err("Flag already exists", "CONFLICT")
    flag = FeatureFlag(
        key=input_data["key"],
        enabled=input_data.get("enabled", False),
        description=input_data.get("description"),
        rollout_percentage=input_data.get("rolloutPercentage", 100.0),
    )
    db.add(flag)
    await db.commit()
    await db.refresh(flag)
    return _result(
        {
            "flag": {
                "key": flag.key,
                "enabled": flag.enabled,
                "description": flag.description,
                "rolloutPercentage": flag.rollout_percentage,
            }
        }
    )


_FEATURE_FLAG_UPDATE_FIELDS = {
    "enabled",
    "description",
    "rollout_percentage",
    "rolloutPercentage",
}


async def _feature_flags_update(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == input_data["key"]))
    flag = result.scalar_one_or_none()
    if not flag:
        return _err("Flag not found", "NOT_FOUND")
    for field in _FEATURE_FLAG_UPDATE_FIELDS & set(input_data.keys()):
        if field == "rolloutPercentage":
            flag.rollout_percentage = input_data[field]
        else:
            setattr(flag, field, input_data[field])
    await db.commit()
    await db.refresh(flag)
    return _result(
        {
            "flag": {
                "key": flag.key,
                "enabled": flag.enabled,
                "description": flag.description,
                "rolloutPercentage": flag.rollout_percentage,
            }
        }
    )


async def _feature_flags_delete(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == input_data["key"]))
    flag = result.scalar_one_or_none()
    if not flag:
        return _err("Flag not found", "NOT_FOUND")
    await db.delete(flag)
    await db.commit()
    return _ok({"success": True})
