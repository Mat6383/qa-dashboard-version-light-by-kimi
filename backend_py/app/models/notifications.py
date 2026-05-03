"""Notification settings & alert log."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NotificationSetting(Base):
    __tablename__ = "notification_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    slack_webhook: Mapped[str | None] = mapped_column(String, nullable=True)
    teams_webhook: Mapped[str | None] = mapped_column(String, nullable=True)
    enabled_sla_email: Mapped[bool] = mapped_column(default=False)
    enabled_sla_slack: Mapped[bool] = mapped_column(default=False)
    enabled_sla_teams: Mapped[bool] = mapped_column(default=False)
    email_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    slack_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    teams_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class AlertLog(Base):
    __tablename__ = "alert_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(Integer, index=True)
    channel: Mapped[str] = mapped_column(String)  # email | slack | teams
    sent_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
