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

# Deux engines car l'app legacy utilise 2 fichiers SQLite.
# En production on peut les merger via Alembic, mais pour la compatibilité
# immédiate on conserve la séparation.
engine_main = create_async_engine(
    settings.db_main_url,
    echo=settings.environment == "development",
    poolclass=NullPool,  # SQLite async n'aime pas les pools classiques
    connect_args={"check_same_thread": False},
)
engine_comments = create_async_engine(
    settings.db_comments_url,
    echo=settings.environment == "development",
    poolclass=NullPool,
    connect_args={"check_same_thread": False},
)

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
    from app.models.integrations import Integration
    from app.models.notifications import AlertLog, NotificationSetting
    from app.models.retention import ArchivedSnapshot, RetentionPolicy
    from app.models.sync_history import MetricSnapshot, ProjectGroup, SyncRun
    from app.models.users import User
    from app.models.webhooks import WebhookSubscription

    for engine in (engine_main, engine_comments):
        async with engine.begin() as conn:
            await conn.exec_driver_sql("PRAGMA journal_mode=WAL")
            await conn.exec_driver_sql("PRAGMA synchronous=NORMAL")
            await conn.exec_driver_sql("PRAGMA busy_timeout=5000")

    # Main DB tables
    async with engine_main.begin() as conn:
        await conn.run_sync(User.__table__.create, checkfirst=True)
        await conn.run_sync(SyncRun.__table__.create, checkfirst=True)
        await conn.run_sync(MetricSnapshot.__table__.create, checkfirst=True)
        await conn.run_sync(ProjectGroup.__table__.create, checkfirst=True)
        await conn.run_sync(AuditLog.__table__.create, checkfirst=True)
        await conn.run_sync(FeatureFlag.__table__.create, checkfirst=True)
        await conn.run_sync(Integration.__table__.create, checkfirst=True)
        await conn.run_sync(NotificationSetting.__table__.create, checkfirst=True)
        await conn.run_sync(AlertLog.__table__.create, checkfirst=True)
        await conn.run_sync(RetentionPolicy.__table__.create, checkfirst=True)
        await conn.run_sync(ArchivedSnapshot.__table__.create, checkfirst=True)
        await conn.run_sync(WebhookSubscription.__table__.create, checkfirst=True)
        await conn.run_sync(AnalyticsInsight.__table__.create, checkfirst=True)

    # Comments DB is separate
    async with engine_comments.begin() as conn:
        await conn.run_sync(CrossTestComment.__table__.create, checkfirst=True)
