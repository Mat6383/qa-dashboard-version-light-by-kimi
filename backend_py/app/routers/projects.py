"""Projects, runs, milestones, automation."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.deps import DBMain
from app.services.testmo import testmo_service

router = APIRouter()


@router.get("/")
async def list_projects(db: DBMain):
    projects = await testmo_service.get_projects()
    return {"projects": projects}


@router.get("/{project_id}/runs")
async def get_project_runs(project_id: int, active: bool = Query(False), db: DBMain = None):
    runs = await testmo_service.get_project_runs(project_id, active_only=active)
    return {"runs": runs}


@router.get("/{project_id}/milestones")
async def get_project_milestones(project_id: int, db: DBMain):
    milestones = await testmo_service.get_project_milestones(project_id)
    return {"success": True, "data": {"result": milestones}}


@router.get("/{project_id}/automation")
async def get_project_automation(project_id: int, db: DBMain):
    automation = await testmo_service.get_automation_runs(project_id)
    return {"automation": automation}
