"""Tests for metrics_snapshot_job."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select, text

from app.jobs.metrics_snapshot import metrics_snapshot_job
from app.models.sync_history import MetricSnapshot


@pytest.mark.asyncio
async def test_metrics_snapshot_job_creates_and_updates(db_session):
    """Job should create snapshots and update existing ones for the same day."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    await db_session.execute(text("DELETE FROM metric_snapshots"))
    await db_session.commit()

    mock_projects = [{"id": 1, "name": "Alpha"}, {"id": 2, "name": "Beta"}]
    mock_metrics = {
        "passRate": 85.5,
        "completionRate": 90.0,
        "blockedRate": 2.0,
        "raw": {"total": 120},
    }

    with patch("app.jobs.metrics_snapshot.testmo_service") as mock_testmo:
        mock_testmo.get_projects = AsyncMock(return_value=mock_projects)
        mock_testmo.get_project_metrics = AsyncMock(return_value=mock_metrics)

        # First run — creates two snapshots
        await metrics_snapshot_job()
        await db_session.commit()

        result = await db_session.execute(select(MetricSnapshot))
        rows = result.scalars().all()
        assert len(rows) == 2

        alpha = next(r for r in rows if r.project_id == 1)
        assert alpha.pass_rate == 85.5
        assert alpha.completion_rate == 90.0
        assert alpha.total_tests == 120
        assert alpha.date == today

    # Second run same day with different metrics — should update
    mock_metrics2 = {
        "passRate": 80.0,
        "completionRate": 95.0,
        "blockedRate": 1.0,
        "raw": {"total": 130},
    }

    with patch("app.jobs.metrics_snapshot.testmo_service") as mock_testmo:
        mock_testmo.get_projects = AsyncMock(return_value=mock_projects)
        mock_testmo.get_project_metrics = AsyncMock(return_value=mock_metrics2)

        await metrics_snapshot_job()
        await db_session.commit()

        db_session.expire_all()
        result = await db_session.execute(select(MetricSnapshot))
        rows = result.scalars().all()
        assert len(rows) == 2  # no duplicate

        alpha = next(r for r in rows if r.project_id == 1)
        assert alpha.pass_rate == 80.0
        assert alpha.completion_rate == 95.0
        assert alpha.total_tests == 130


@pytest.mark.asyncio
async def test_metrics_snapshot_job_skips_missing_project_id(db_session):
    """Job should skip projects without an id."""
    await db_session.execute(text("DELETE FROM metric_snapshots"))
    await db_session.commit()

    mock_projects = [{"name": "NoId"}]

    with patch("app.jobs.metrics_snapshot.testmo_service") as mock_testmo:
        mock_testmo.get_projects = AsyncMock(return_value=mock_projects)

        await metrics_snapshot_job()
        await db_session.commit()

        result = await db_session.execute(select(MetricSnapshot))
        rows = result.scalars().all()
        assert len(rows) == 0


@pytest.mark.asyncio
async def test_metrics_snapshot_job_continues_on_error(db_session):
    """Job should continue with next project if one fails."""
    await db_session.execute(text("DELETE FROM metric_snapshots"))
    await db_session.commit()

    mock_projects = [{"id": 1, "name": "Ok"}, {"id": 2, "name": "Fail"}]

    async def side_effect(pid: int):
        if pid == 2:
            raise RuntimeError("boom")
        return {"passRate": 99, "completionRate": 100, "blockedRate": 0, "raw": {"total": 10}}

    with patch("app.jobs.metrics_snapshot.testmo_service") as mock_testmo:
        mock_testmo.get_projects = AsyncMock(return_value=mock_projects)
        mock_testmo.get_project_metrics = AsyncMock(side_effect=side_effect)

        await metrics_snapshot_job()
        await db_session.commit()

        result = await db_session.execute(select(MetricSnapshot))
        rows = result.scalars().all()
        assert len(rows) == 1
        assert rows[0].project_id == 1
