"""Basic model / DB integration tests."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete, select

from app.database import get_main_db
from app.models.sync_history import SyncRun
from app.models.users import User


@pytest.mark.asyncio
async def test_create_sync_run() -> None:
    project = f"test-project-{uuid.uuid4().hex[:8]}"
    async with get_main_db() as db:
        run = SyncRun(
            project_name=project,
            iteration_name="v1.0",
            mode="manual",
            created=10,
            updated=5,
            skipped=1,
            enriched=2,
            errors=0,
            total_issues=15,
            testmo_run_id=123,
            testmo_run_url="https://testmo.example.com/automation/runs/123",
        )
        db.add(run)
        await db.commit()

        result = await db.execute(select(SyncRun).where(SyncRun.project_name == project))
        fetched = result.scalar_one()
        assert fetched.iteration_name == "v1.0"
        assert fetched.total_issues == 15
        assert fetched.testmo_run_id == 123
        assert fetched.testmo_run_url == "https://testmo.example.com/automation/runs/123"

        # cleanup
        await db.execute(delete(SyncRun).where(SyncRun.project_name == project))
        await db.commit()


@pytest.mark.asyncio
async def test_create_user() -> None:
    gitlab_id = 900000 + hash(uuid.uuid4().hex) % 100000
    async with get_main_db() as db:
        # cleanup any pre-existing test user with this id
        await db.execute(delete(User).where(User.gitlab_id == gitlab_id))
        await db.commit()

        user = User(
            gitlab_id=gitlab_id,
            email=f"{uuid.uuid4().hex}@example.com",
            name="Test User",
            role="viewer",
        )
        db.add(user)
        await db.commit()

        result = await db.execute(select(User).where(User.gitlab_id == gitlab_id))
        fetched = result.scalar_one()
        assert fetched.role == "viewer"

        # cleanup
        await db.execute(delete(User).where(User.gitlab_id == gitlab_id))
        await db.commit()
