"""Sync history, metric snapshots & project groups."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_name: Mapped[str] = mapped_column(String)
    iteration_name: Mapped[str | None] = mapped_column(String, nullable=True)
    mode: Mapped[str] = mapped_column(String, default="manual")
    created: Mapped[int] = mapped_column(Integer, default=0)
    updated: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    enriched: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[int] = mapped_column(Integer, default=0)
    total_issues: Mapped[int] = mapped_column(Integer, default=0)
    testmo_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    testmo_run_url: Mapped[str | None] = mapped_column(String, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )


class SyncCaseRun(Base):
    __tablename__ = "sync_case_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(Integer, nullable=False)
    iteration_name: Mapped[str] = mapped_column(String, nullable=False)
    folder_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    folder_url: Mapped[str | None] = mapped_column(String, nullable=True)
    stats_created: Mapped[int] = mapped_column(Integer, default=0)
    stats_updated: Mapped[int] = mapped_column(Integer, default=0)
    stats_skipped: Mapped[int] = mapped_column(Integer, default=0)
    stats_errors: Mapped[int] = mapped_column(Integer, default=0)
    details: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )


class AutoSyncConfig(Base):
    __tablename__ = "auto_sync_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    enabled: Mapped[bool] = mapped_column(default=False)
    mode: Mapped[str] = mapped_column(String, default="cases")
    gitlab_project_id: Mapped[str | None] = mapped_column(String, nullable=True)
    testmo_project_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    iteration_name: Mapped[str | None] = mapped_column(String, nullable=True)
    run_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    version: Mapped[str | None] = mapped_column(String, nullable=True)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    gitlab_status: Mapped[str | None] = mapped_column(String, nullable=True)
    version_prod: Mapped[str | None] = mapped_column(String, nullable=True)
    version_test: Mapped[str | None] = mapped_column(String, nullable=True)
    timezone: Mapped[str] = mapped_column(String, default="Europe/Paris")
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class MetricSnapshot(Base):
    __tablename__ = "metric_snapshots"
    __table_args__ = (UniqueConstraint("project_id", "date", name="uq_metric_snapshots_project_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(Integer, index=True)
    date: Mapped[str] = mapped_column(String, index=True)  # ISO date
    pass_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    completion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    escape_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    detection_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    blocked_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_tests: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )


class ProjectGroup(Base):
    __tablename__ = "project_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String)
    project_ids: Mapped[list[int]]  # JSON array in SQLite
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
