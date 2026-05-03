"""Retention & archiving router."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import DBMain, require_admin
from app.schemas import (
    RetentionArchiveOut,
    RetentionCycleResponse,
    RetentionPolicyOut,
    RetentionPolicyUpdate,
)
from app.services.retention import retention_service

router = APIRouter()


@router.get("/policies", dependencies=[Depends(require_admin)])
async def get_policies(db: DBMain = None) -> dict:
    policies = await retention_service.get_policies(db)
    return {"policies": [RetentionPolicyOut.model_validate(p) for p in policies]}


@router.put("/policies", dependencies=[Depends(require_admin)])
async def update_policy(payload: RetentionPolicyUpdate, db: DBMain = None) -> dict:
    policy = await retention_service.update_policy(
        db,
        payload.entity_type,
        payload.retention_days,
        payload.auto_archive,
        payload.auto_delete,
    )
    return {"policy": RetentionPolicyOut.model_validate(policy)}


@router.get("/archives", dependencies=[Depends(require_admin)])
async def get_archives(
    entity_type: str | None = None,
    limit: int = 100,
    db: DBMain = None,
) -> dict:
    archives = await retention_service.get_archives(db, entity_type, limit)
    return {"archives": [RetentionArchiveOut.model_validate(a) for a in archives]}


@router.post("/run-cycle", dependencies=[Depends(require_admin)])
async def run_cycle(db: DBMain = None) -> RetentionCycleResponse:
    result = await retention_service.run_retention_cycle(db)
    return RetentionCycleResponse(**result)
