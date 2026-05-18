"""Service-level unit tests with mocked internals."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.circuit_breaker import CircuitBreaker, State
from app.services.gitlab import GitLabService
from app.services.testmo import TestmoService
from app.services.testmo_metrics import TestmoMetrics


@pytest.mark.asyncio
async def test_get_project_metrics_includes_exploratory_sessions() -> None:
    """Sessions exploratoires doivent être fusionnées dans runs avec isExploratory=True."""
    mock_client = MagicMock()
    mock_client.get_project_runs = AsyncMock(
        return_value=[
            {
                "id": 1,
                "name": "Run standard",
                "milestone_id": 10,
                "total_count": 10,
                "completed_count": 5,
                "status1_count": 4,
                "status2_count": 1,
                "status3_count": 0,
                "status4_count": 0,
                "status5_count": 0,
                "status7_count": 0,
                "untested_count": 5,
                "success_count": 4,
                "failure_count": 1,
                "created_at": "2026-01-01T00:00:00Z",
            }
        ]
    )
    mock_client.get_project_sessions = AsyncMock(
        return_value=[
            {
                "id": 99,
                "name": "Session exploratoire R14",
                "milestone_id": 10,
                "total_count": 3,
                "completed_count": 2,
                "status1_count": 2,
                "status2_count": 0,
                "status3_count": 0,
                "status4_count": 0,
                "status5_count": 0,
                "status7_count": 1,
                "untested_count": 1,
                "success_count": 2,
                "failure_count": 0,
                "created_at": "2026-01-02T00:00:00Z",
            }
        ]
    )

    metrics = TestmoMetrics(mock_client)
    result = await metrics.get_project_metrics(1, milestone_ids=[10])

    runs = result["runs"]
    assert len(runs) == 2
    standard = next(r for r in runs if r["id"] == 1)
    exploratory = next(r for r in runs if r["id"] == 99)

    assert standard["isExploratory"] is False
    assert exploratory["isExploratory"] is True
    assert exploratory["name"] == "Session exploratoire R14"
    assert exploratory["milestone"] == 10
    assert exploratory["passed"] == 2
    assert exploratory["total"] == 3

    # Les KPI globaux ne doivent pas être pollués par les sessions
    assert result["runsCount"] == 2
    assert result["raw"]["total"] == 10  # uniquement le run standard


@pytest.mark.asyncio
async def test_get_project_metrics_sessions_filtered_by_milestone() -> None:
    """Les sessions doivent être filtrées par milestone_ids comme les runs."""
    mock_client = MagicMock()
    mock_client.get_project_runs = AsyncMock(return_value=[])
    mock_client.get_project_sessions = AsyncMock(
        return_value=[
            {
                "id": 1,
                "name": "S1",
                "milestone_id": 10,
                "total_count": 0,
                "completed_count": 0,
                "status1_count": 0,
                "status2_count": 0,
                "status4_count": 0,
                "status5_count": 0,
                "status7_count": 0,
                "untested_count": 0,
                "success_count": 0,
                "failure_count": 0,
            },
            {
                "id": 2,
                "name": "S2",
                "milestone_id": 20,
                "total_count": 0,
                "completed_count": 0,
                "status1_count": 0,
                "status2_count": 0,
                "status4_count": 0,
                "status5_count": 0,
                "status7_count": 0,
                "untested_count": 0,
                "success_count": 0,
                "failure_count": 0,
            },
        ]
    )

    metrics = TestmoMetrics(mock_client)
    result = await metrics.get_project_metrics(1, milestone_ids=[10])

    assert len(result["runs"]) == 1
    assert result["runs"][0]["id"] == 1


@pytest.mark.asyncio
async def test_circuit_breaker_opens_after_threshold() -> None:
    cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)

    async def fail() -> None:
        raise ValueError("boom")

    for _ in range(3):
        with pytest.raises(ValueError):
            await cb.call(fail)

    assert cb.state == State.OPEN
    with pytest.raises(Exception):
        await cb.call(fail)


@pytest.mark.asyncio
async def test_testmo_get_projects_cached() -> None:
    svc = TestmoService()
    svc.cache.clear()

    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"result": [{"id": 1, "name": "P1"}]}
        data = await svc.get_projects()
        assert data[0]["name"] == "P1"
        assert mock_get.call_count == 1

        # second call should hit cache
        data2 = await svc.get_projects()
        assert data2[0]["name"] == "P1"
        assert mock_get.call_count == 1


@pytest.mark.asyncio
async def test_gitlab_health_check() -> None:
    svc = GitLabService()
    with patch.object(svc, "_rest_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"id": 1, "username": "root"}
        ok = await svc.health_check()
        assert ok is True
