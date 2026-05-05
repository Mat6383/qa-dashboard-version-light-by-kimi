"""Tests for SmartAlertsService algorithms."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.models.sync_history import MetricSnapshot
from app.services.smart_alerts import SmartAlertsService


def _snapshot(
    pass_rate: float | None = None,
    completion_rate: float | None = None,
    total_tests: int | None = None,
) -> MetricSnapshot:
    return MetricSnapshot(
        id=1,
        project_id=1,
        date="2026-05-01",
        pass_rate=pass_rate,
        completion_rate=completion_rate,
        escape_rate=None,
        detection_rate=None,
        blocked_rate=None,
        total_tests=total_tests,
        created_at=datetime.now(timezone.utc),
    )


class TestRegressionDetection:
    def test_no_regression_when_rate_increases(self) -> None:
        svc = SmartAlertsService()
        snaps = [_snapshot(pass_rate=80.0), _snapshot(pass_rate=90.0)]
        assert svc._detect_regression(snaps) is None

    def test_no_regression_when_drop_is_small(self) -> None:
        svc = SmartAlertsService()
        snaps = [_snapshot(pass_rate=85.0), _snapshot(pass_rate=82.0)]
        assert svc._detect_regression(snaps) is None

    def test_regression_when_drop_above_10pts(self) -> None:
        svc = SmartAlertsService()
        snaps = [_snapshot(pass_rate=85.0), _snapshot(pass_rate=74.0)]
        result = svc._detect_regression(snaps)
        assert result is not None
        assert result["data"]["drop"] == 11.0
        assert result["data"]["severity"] == "medium"

    def test_high_severity_when_drop_above_20pts(self) -> None:
        svc = SmartAlertsService()
        snaps = [_snapshot(pass_rate=90.0), _snapshot(pass_rate=65.0)]
        result = svc._detect_regression(snaps)
        assert result is not None
        assert result["data"]["severity"] == "high"
        assert result["confidence"] > 0.9

    def test_regression_with_statistical_significance(self) -> None:
        svc = SmartAlertsService()
        # Stable history then sudden drop
        snaps = [
            _snapshot(pass_rate=80.0),
            _snapshot(pass_rate=81.0),
            _snapshot(pass_rate=80.0),
            _snapshot(pass_rate=81.0),
            _snapshot(pass_rate=60.0),
        ]
        result = svc._detect_regression(snaps)
        assert result is not None
        assert result["data"]["drop"] == 21.0


class TestEndDatePrediction:
    def test_no_prediction_when_complete(self) -> None:
        svc = SmartAlertsService()
        snaps = [_snapshot(completion_rate=100.0, total_tests=100)]
        assert svc._predict_end_date(snaps) is None

    def test_stalled_progress(self) -> None:
        svc = SmartAlertsService()
        snaps = [
            _snapshot(completion_rate=50.0, total_tests=100),
            _snapshot(completion_rate=50.0, total_tests=100),
        ]
        result = svc._predict_end_date(snaps)
        assert result is not None
        assert result["data"]["velocity_per_day"] == 0.0
        assert result["data"]["predicted_end_date"] is None

    def test_prediction_with_velocity(self) -> None:
        svc = SmartAlertsService()
        snaps = [
            _snapshot(completion_rate=50.0, total_tests=100),
            _snapshot(completion_rate=60.0, total_tests=100),
            _snapshot(completion_rate=70.0, total_tests=100),
        ]
        result = svc._predict_end_date(snaps)
        assert result is not None
        assert result["data"]["velocity_per_day"] == 10.0
        assert result["data"]["days_left"] == 3.0
        assert "2026-" in result["data"]["predicted_end_date"]


class TestAdaptiveThreshold:
    def test_no_alert_when_within_range(self) -> None:
        svc = SmartAlertsService()
        snaps = [
            _snapshot(pass_rate=80.0),
            _snapshot(pass_rate=82.0),
            _snapshot(pass_rate=81.0),
            _snapshot(pass_rate=80.0),
        ]
        assert svc._adaptive_threshold(snaps) is None

    def test_alert_when_below_lower_bound(self) -> None:
        svc = SmartAlertsService()
        snaps = [
            _snapshot(pass_rate=80.0),
            _snapshot(pass_rate=81.0),
            _snapshot(pass_rate=79.0),
            _snapshot(pass_rate=80.0),
            _snapshot(pass_rate=82.0),
            _snapshot(pass_rate=20.0),
        ]
        result = svc._adaptive_threshold(snaps)
        assert result is not None
        assert result["data"]["direction"] == "below"
        assert "Below" in result["title"]

    def test_alert_when_above_upper_bound(self) -> None:
        svc = SmartAlertsService()
        snaps = [
            _snapshot(pass_rate=80.0),
            _snapshot(pass_rate=81.0),
            _snapshot(pass_rate=79.0),
            _snapshot(pass_rate=80.0),
            _snapshot(pass_rate=82.0),
            _snapshot(pass_rate=99.0),
        ]
        result = svc._adaptive_threshold(snaps)
        assert result is not None
        assert result["data"]["direction"] == "above"
        assert "Above" in result["title"]


@pytest.mark.asyncio
async def test_analyze_project_persists_insight() -> None:
    """Integration-style test: run analyze_project against real SQLite DB."""
    from app.database import get_main_db
    from app.services.smart_alerts import smart_alerts_service
    from app.models.sync_history import MetricSnapshot
    from app.models.analytics import AnalyticsInsight
    from sqlalchemy import select, delete

    pid = 9999  # unique to avoid collisions
    async with get_main_db() as db:
        # Cleanup any previous data for this pid
        await db.execute(delete(AnalyticsInsight).where(AnalyticsInsight.project_id == pid))
        await db.execute(delete(MetricSnapshot).where(MetricSnapshot.project_id == pid))
        await db.commit()

        # Seed snapshots
        for i, rate in enumerate([80.0, 82.0, 81.0, 50.0]):
            db.add(
                MetricSnapshot(
                    project_id=pid,
                    date=f"2026-05-0{i+1}",
                    pass_rate=rate,
                    completion_rate=50.0 + i * 10,
                    total_tests=100,
                )
            )
        await db.commit()

        result = await smart_alerts_service.analyze_project(db, pid)
        assert result["insights_created"] >= 1
        assert result["snapshots_analyzed"] == 4

        # Verify persistence
        stmt = select(AnalyticsInsight).where(AnalyticsInsight.project_id == pid)
        res = await db.execute(stmt)
        insights = res.scalars().all()
        assert len(insights) >= 1
        assert insights[0].type == "smart_alert"

        # Cleanup
        await db.execute(delete(AnalyticsInsight).where(AnalyticsInsight.project_id == pid))
        await db.execute(delete(MetricSnapshot).where(MetricSnapshot.project_id == pid))
        await db.commit()
