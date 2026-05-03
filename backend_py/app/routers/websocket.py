"""WebSocket endpoints for real-time dashboard."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.testmo import testmo_service

router = APIRouter()


@router.websocket("/dashboard")
async def dashboard_websocket(
    websocket: WebSocket,
    project_id: int = Query(..., alias="projectId"),
    preprod_milestones: str = Query("", alias="preprodMilestones"),
    prod_milestones: str = Query("", alias="prodMilestones"),
):
    await websocket.accept()
    try:
        while True:
            try:
                metrics = await testmo_service.get_project_metrics(project_id)
                # Attempt quality rates if milestones are provided
                quality = {"escape_rate": 0.0, "detection_rate": 0.0}
                if preprod_milestones or prod_milestones:
                    quality = await testmo_service.get_escape_and_detection_rates(project_id)

                payload = {
                    "type": "metrics",
                    "project_id": project_id,
                    "data": {
                        **metrics,
                        "escape_rate": quality.get("escape_rate", 0.0),
                        "detection_rate": quality.get("detection_rate", 0.0),
                        "timestamp": asyncio.get_event_loop().time(),
                    },
                }
                await websocket.send_text(json.dumps(payload))
            except Exception as exc:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": str(exc)})
                )
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
