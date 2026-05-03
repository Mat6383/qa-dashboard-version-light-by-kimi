"""CrossTest comments (stored in separate DB)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CrossTestComment(Base):
    __tablename__ = "crosstest_comments"
    __table_args__ = (
        UniqueConstraint("issue_iid", "gitlab_project_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_iid: Mapped[int] = mapped_column(Integer, index=True)
    gitlab_project_id: Mapped[int] = mapped_column(Integer, default=63, index=True)
    milestone_context: Mapped[str | None] = mapped_column(String, nullable=True)
    comment: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
