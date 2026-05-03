"""Retention policies & archived snapshots."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RetentionPolicy(Base):
    __tablename__ = "retention_policies"

    entity_type: Mapped[str] = mapped_column(String, primary_key=True)
    retention_days: Mapped[int] = mapped_column(Integer, default=365)
    auto_archive: Mapped[bool] = mapped_column(default=True)
    auto_delete: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ArchivedSnapshot(Base):
    __tablename__ = "archived_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String)
    entity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data_json: Mapped[dict[str, Any]]
    archived_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
