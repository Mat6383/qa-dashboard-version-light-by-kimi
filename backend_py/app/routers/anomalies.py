"""Anomaly detection (Z-score)."""

from fastapi import APIRouter

from app.deps import DBMain
from app.services.anomaly import anomaly_service

router = APIRouter()


@router.get("/{project_id}")
async def get_anomalies(project_id: int, db: DBMain):
    anomalies = await anomaly_service.detect(project_id)
    return {"anomalies": anomalies}
