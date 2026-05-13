"""Feedback sync history model."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FeedbackSyncRun(Base):
    __tablename__ = "feedback_sync_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    triggered_by: Mapped[str] = mapped_column(String, default="cron")
    project_id: Mapped[int] = mapped_column(Integer, nullable=False)
    runs_scanned: Mapped[int] = mapped_column(Integer, default=0)
    results_checked: Mapped[int] = mapped_column(Integer, default=0)
    tickets_created: Mapped[int] = mapped_column(Integer, default=0)
    tickets_skipped: Mapped[int] = mapped_column(Integer, default=0)
    details: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
