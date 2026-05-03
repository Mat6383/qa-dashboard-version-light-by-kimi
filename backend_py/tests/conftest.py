"""Pytest fixtures."""

from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.database import init_databases
from app.main import app


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_db() -> None:
    """Initialize SQLite tables once per test session."""
    await init_databases()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
