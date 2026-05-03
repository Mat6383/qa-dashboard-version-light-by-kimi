"""Third-party integrations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(
        String
    )  # jira | azure_devops | generic_webhook | gitlab
    config_json: Mapped[dict[str, Any]] = mapped_column(default=dict)
    enabled: Mapped[bool] = mapped_column(default=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
