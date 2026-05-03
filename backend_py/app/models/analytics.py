"""Analytics insights."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AnalyticsInsight(Base):
    __tablename__ = "analytics_insights"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(Integer, index=True)
    type: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, default=0.8)
    data_json: Mapped[dict[str, Any] | None]
    read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
