"""Z-score anomaly detection over historical metrics."""

from __future__ import annotations

import math
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from app.database import get_main_db
from app.models.sync_history import MetricSnapshot
from app.services.testmo import testmo_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

METRIC_KEYS = ["pass_rate", "completion_rate", "escape_rate", "detection_rate", "blocked_rate", "total_tests"]


class AnomalyService:
    async def detect(self, project_id: int) -> list[dict[str, Any]]:
        # Fetch snapshots from DB
        async with get_main_db() as db:
            result = await db.execute(
                select(MetricSnapshot)
                .where(MetricSnapshot.project_id == project_id)
                .order_by(MetricSnapshot.date)
            )
            snapshots = result.scalars().all()

        if len(snapshots) < 3:
            # Not enough history; return empty but also try to compute from runs
            return await self._detect_from_runs(project_id)

        anomalies = []
        for metric in METRIC_KEYS:
            values = [getattr(s, metric) for s in snapshots if getattr(s, metric) is not None]
            if len(values) < 3:
                continue
            mean = statistics.mean(values)
            stdev = statistics.stdev(values) if len(values) > 1 else 0.0
            if stdev == 0:
                continue
            latest = values[-1]
            z_score = (latest - mean) / stdev
            if abs(z_score) > 2.0:
                severity = "high" if abs(z_score) > 3.0 else "medium"
                anomalies.append({
                    "project_id": project_id,
                    "metric": metric,
                    "value": round(latest, 2),
                    "expected_range": [round(mean - 2 * stdev, 2), round(mean + 2 * stdev, 2)],
                    "z_score": round(z_score, 2),
                    "severity": severity,
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                })
        return anomalies

    async def _detect_from_runs(self, project_id: int) -> list[dict[str, Any]]:
        """Fallback: use current runs to detect trivial anomalies."""
        runs = await testmo_service.get_project_runs(project_id)
        if not runs:
            return []

        metrics = await testmo_service.get_project_metrics(project_id)
        anomalies = []
        if metrics.get("pass_rate", 100) < 50:
            anomalies.append({
                "project_id": project_id,
                "metric": "pass_rate",
                "value": metrics["pass_rate"],
                "expected_range": [50.0, 100.0],
                "z_score": 0.0,
                "severity": "high",
                "detected_at": datetime.now(timezone.utc).isoformat(),
            })
        if metrics.get("blocked_rate", 0) > 20:
            anomalies.append({
                "project_id": project_id,
                "metric": "blocked_rate",
                "value": metrics["blocked_rate"],
                "expected_range": [0.0, 20.0],
                "z_score": 0.0,
                "severity": "medium",
                "detected_at": datetime.now(timezone.utc).isoformat(),
            })
        return anomalies


anomaly_service = AnomalyService()
