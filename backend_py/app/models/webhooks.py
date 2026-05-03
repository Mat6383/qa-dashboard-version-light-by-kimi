"""Webhook subscriptions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[str] = mapped_column(String)
    events: Mapped[list[str]]  # JSON array in SQLite
    secret: Mapped[str] = mapped_column(String)
    enabled: Mapped[bool] = mapped_column(default=True)
    filters: Mapped[dict[str, Any] | None]  # JSON dict
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
