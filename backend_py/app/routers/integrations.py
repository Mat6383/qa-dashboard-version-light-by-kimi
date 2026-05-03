"""Third-party integrations router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.deps import DBMain, require_admin
from app.models.integrations import Integration
from app.schemas import IntegrationCreate, IntegrationOut, IntegrationUpdate, JiraIssueCreate
from app.services.jira import integration_service

router = APIRouter()


@router.get("/", dependencies=[Depends(require_admin)])
async def list_integrations(db: DBMain) -> dict:
    result = await db.execute(select(Integration))
    rows = result.scalars().all()
    return {"integrations": [IntegrationOut.model_validate(r) for r in rows]}


@router.get("/{integration_id}", dependencies=[Depends(require_admin)])
async def get_integration(integration_id: int, db: DBMain) -> dict:
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"integration": IntegrationOut.model_validate(row)}


@router.post("/", dependencies=[Depends(require_admin)])
async def create_integration(payload: IntegrationCreate, db: DBMain) -> dict:
    data = payload.model_dump()
    data["config_json"] = data.pop("config", {})
    integration = Integration(**data)
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return {"integration": IntegrationOut.model_validate(integration)}


@router.put("/{integration_id}", dependencies=[Depends(require_admin)])
async def update_integration(integration_id: int, payload: IntegrationUpdate, db: DBMain) -> dict:
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Integration not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return {"integration": IntegrationOut.model_validate(row)}


@router.delete("/{integration_id}", dependencies=[Depends(require_admin)])
async def delete_integration(integration_id: int, db: DBMain) -> dict:
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Integration not found")
    await db.delete(row)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{integration_id}/test", dependencies=[Depends(require_admin)])
async def test_integration(integration_id: int, db: DBMain) -> dict:
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Integration not found")
    if row.type == "jira":
        return await integration_service.test_jira_connection(row.config_json)
    if row.type == "gitlab":
        return await integration_service.test_gitlab_connection(row.config_json)
    if row.type == "generic_webhook":
        return await integration_service.send_generic_webhook(
            row.config_json, {"event": "test", "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()}
        )
    return {"success": False, "error": "Type not supported for test"}


@router.post("/{integration_id}/jira-issue", dependencies=[Depends(require_admin)])
async def create_jira_issue(integration_id: int, payload: JiraIssueCreate, db: DBMain) -> dict:
    result = await db.execute(select(Integration).where(Integration.id == integration_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Integration not found")
    if row.type != "jira":
        raise HTTPException(status_code=400, detail="Integration is not Jira")
    resp = await integration_service.create_jira_issue(
        row.config_json,
        payload.summary,
        payload.description,
        payload.issue_type,
    )
    if resp.get("success"):
        row.last_sync_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
        await db.commit()
    return resp
