"""Post, post asset link, and publishing job models."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Post(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "posts"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), index=True
    )
    content_idea_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_ideas.id", ondelete="SET NULL")
    )
    platform_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("platform_accounts.id", ondelete="SET NULL")
    )
    platform: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="post_draft", index=True)
    title: Mapped[Optional[str]] = mapped_column(Text)
    caption: Mapped[Optional[str]] = mapped_column(Text)
    hashtags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    cta: Mapped[Optional[str]] = mapped_column(Text)
    pillar_slug: Mapped[Optional[str]] = mapped_column(Text, index=True)
    format: Mapped[Optional[str]] = mapped_column(Text)
    hook_type: Mapped[Optional[str]] = mapped_column(Text)
    caption_type: Mapped[Optional[str]] = mapped_column(Text)
    asset_type: Mapped[Optional[str]] = mapped_column(Text)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    external_post_id: Mapped[Optional[str]] = mapped_column(Text)
    external_url: Mapped[Optional[str]] = mapped_column(Text)
    tracking_link_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tracking_links.id", ondelete="SET NULL", use_alter=True, name="fk_posts_tracking_link_id"),
    )
    utm_source: Mapped[Optional[str]] = mapped_column(Text)
    utm_medium: Mapped[Optional[str]] = mapped_column(Text)
    utm_campaign: Mapped[Optional[str]] = mapped_column(Text)
    utm_content: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    approved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    post_assets: Mapped[list["PostAsset"]] = relationship(
        back_populates="post", cascade="all, delete-orphan", order_by="PostAsset.sort_order"
    )


class PostAsset(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "post_assets"
    __table_args__ = (UniqueConstraint("post_id", "asset_id", "role", name="uq_post_assets_post_asset_role"),)

    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    asset_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset_versions.id", ondelete="SET NULL")
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    role: Mapped[str] = mapped_column(Text, nullable=False, default="primary")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    post: Mapped["Post"] = relationship(back_populates="post_assets")
    asset: Mapped["Asset"] = relationship()


class PublishingJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "publishing_jobs"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("platform_accounts.id", ondelete="SET NULL")
    )
    provider_type: Mapped[str] = mapped_column(Text, nullable=False, default="buffer", index=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="queued", index=True)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), index=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    external_job_id: Mapped[Optional[str]] = mapped_column(Text)
    external_post_id: Mapped[Optional[str]] = mapped_column(Text)
    external_url: Mapped[Optional[str]] = mapped_column(Text)
    provider_request: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    provider_response: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error_code: Mapped[Optional[str]] = mapped_column(Text)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
