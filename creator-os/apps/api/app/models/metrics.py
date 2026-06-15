"""Post-level and daily character metric models."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PostMetric(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "post_metrics"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    source: Mapped[str] = mapped_column(Text, nullable=False, default="manual")
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    views: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    reach: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    likes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    comments: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    shares: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    saves: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    followers_gained: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    profile_visits: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    link_clicks: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    dm_count_manual: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    engagement_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    profile_visit_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    link_click_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    growth_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), index=True)
    raw_metrics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class DailyCharacterMetric(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "daily_character_metrics"
    __table_args__ = (
        UniqueConstraint("character_id", "platform", "metric_date", name="uq_daily_metrics_character_platform_date"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    metric_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    platform: Mapped[Optional[str]] = mapped_column(Text, index=True)
    source: Mapped[str] = mapped_column(Text, nullable=False, default="manual")
    views: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    reach: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    likes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    comments: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    shares: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    saves: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    followers_total: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    followers_delta: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    profile_visits: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    link_clicks: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    dm_count_manual: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    published_posts_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    raw_metrics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
