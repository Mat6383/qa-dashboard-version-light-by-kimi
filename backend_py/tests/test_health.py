"""Health endpoint tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    response = await client.get("/api/health/")
    assert response.status_code == 200
    assert response.json()["status"] == "OK"
    assert response.json()["version"] == "3.0.0"


@pytest.mark.asyncio
async def test_readiness(client: AsyncClient) -> None:
    response = await client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "OK"


@pytest.mark.asyncio
async def test_detailed_health(client: AsyncClient) -> None:
    response = await client.get("/api/health/detailed")
    assert response.status_code == 200
    data = response.json()
    # Status can be OK or DEGRADED depending on external service availability
    assert data["status"] in ("OK", "DEGRADED")
    assert "disk" in data
    assert "usage_percent" in data["disk"]
    assert "checks" in data
    assert "circuit_breakers" in data
