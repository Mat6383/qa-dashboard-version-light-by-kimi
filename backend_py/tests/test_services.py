"""Service-level unit tests with mocked internals."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.core.circuit_breaker import CircuitBreaker, State
from app.services.gitlab import GitLabService
from app.services.testmo import TestmoService


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
