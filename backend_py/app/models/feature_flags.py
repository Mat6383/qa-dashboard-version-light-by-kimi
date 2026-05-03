"""Feature flags with rollout percentage."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    enabled: Mapped[bool] = mapped_column(default=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    rollout_percentage: Mapped[float] = mapped_column(Float, default=100.0)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
