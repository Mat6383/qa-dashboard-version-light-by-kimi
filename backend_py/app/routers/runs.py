"""Run details & results."""

from fastapi import APIRouter, Query

from app.deps import DBMain
from app.services.testmo import testmo_service

router = APIRouter()


@router.get("/{run_id}")
async def get_run(run_id: int, db: DBMain):
    run = await testmo_service.get_run_details(run_id)
    return run


@router.get("/{run_id}/results")
async def get_run_results(run_id: int, status: str | None = Query(None), db: DBMain = None):
    results = await testmo_service.get_run_results(run_id, status_filter=status)
    return {"results": results}
