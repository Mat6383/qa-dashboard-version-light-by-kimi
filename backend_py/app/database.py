"""SQLAlchemy engines, sessions et utility functions."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.config import settings


def _is_postgres(url: str) -> bool:
    return url.startswith("postgresql")


# ------------------------------------------------------------------
# Engine creation — SQLite (dev/local) vs PostgreSQL (production)
# ------------------------------------------------------------------


def _create_engine(url: str):
    if _is_postgres(url):
        # PostgreSQL: asyncpg handles pooling natively
        return create_async_engine(
            url,
            echo=settings.environment == "development",
        )
    # SQLite: NullPool required for async + cross-thread safety
    return create_async_engine(
        url,
        echo=settings.environment == "development",
        poolclass=NullPool,
        connect_args={"check_same_thread": False},
    )


engine_main = _create_engine(settings.db_main_url)
engine_comments = _create_engine(settings.db_comments_url)

async_session_main = async_sessionmaker(engine_main, expire_on_commit=False)
async_session_comments = async_sessionmaker(engine_comments, expire_on_commit=False)


@asynccontextmanager
async def get_main_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_main() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_comments_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_comments() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_databases() -> None:
    """Run pragmas and create missing tables on each engine."""
    from app.models.analytics import AnalyticsInsight
    from app.models.audit import AuditLog
    from app.models.comments import CrossTestComment
    from app.models.feature_flags import FeatureFlag
    from app.models.feedback_sync import FeedbackSyncRun
    from app.models.integrations import Integration
    from app.models.notifications import AlertLog, NotificationSetting
    from app.models.retention import ArchivedSnapshot, RetentionPolicy
    from app.models.sync_history import (
        AutoSyncConfig,
        MetricSnapshot,
        ProjectGroup,
        SyncCaseRun,
        SyncRun,
    )
    from app.models.users import User
    from app.models.webhooks import WebhookSubscription

    is_pg = bool(settings.database_url)

    if not is_pg:
        # SQLite-specific pragmas for performance & concurrency
        for engine in (engine_main, engine_comments):
            async with engine.begin() as conn:
                await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
                await conn.exec_driver_sql("PRAGMA synchronous=NORMAL")
                await conn.exec_driver_sql("PRAGMA busy_timeout=5000")

    # All models live in the same DB under PostgreSQL, or split across
    # two SQLite files.  checkfirst=True makes this idempotent.
    main_models = [
        User,
        SyncRun,
        SyncCaseRun,
        AutoSyncConfig,
        MetricSnapshot,
        ProjectGroup,
        AuditLog,
        FeatureFlag,
        FeedbackSyncRun,
        Integration,
        NotificationSetting,
        AlertLog,
        RetentionPolicy,
        ArchivedSnapshot,
        WebhookSubscription,
        AnalyticsInsight,
    ]

    async with engine_main.begin() as conn:
        for model in main_models:
            await conn.run_sync(model.__table__.create, checkfirst=True)
        await conn.run_sync(CrossTestComment.__table__.create, checkfirst=True)

    if not is_pg:
        # Comments DB is a separate SQLite file
        async with engine_comments.begin() as conn:
            await conn.run_sync(CrossTestComment.__table__.create, checkfirst=True)
