"""Asset and asset version models."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Asset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "assets"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="SET NULL"), index=True
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), index=True
    )
    generation_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("generation_jobs.id", ondelete="SET NULL")
    )
    parent_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL")
    )
    asset_type: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(Text, nullable=False, default="uploaded")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="uploaded", index=True)
    title: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    provider_type: Mapped[Optional[str]] = mapped_column(Text)
    provider_model: Mapped[Optional[str]] = mapped_column(Text)
    original_prompt: Mapped[Optional[str]] = mapped_column(Text)
    constraints_text: Mapped[Optional[str]] = mapped_column(Text)
    storage_key: Mapped[Optional[str]] = mapped_column(Text)
    public_url: Mapped[Optional[str]] = mapped_column(Text)
    mime_type: Mapped[Optional[str]] = mapped_column(Text)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    duration_seconds: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    aspect_ratio: Mapped[Optional[str]] = mapped_column(Text)
    platform_fit: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    risk_recommendation: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    versions: Mapped[list["AssetVersion"]] = relationship(
        back_populates="asset", cascade="all, delete-orphan", order_by="AssetVersion.version_number"
    )


class AssetVersion(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "asset_versions"
    __table_args__ = (UniqueConstraint("asset_id", "version_number", name="uq_asset_versions_asset_version"),)

    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    generation_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("generation_jobs.id", ondelete="SET NULL"), index=True
    )
    storage_key: Mapped[Optional[str]] = mapped_column(Text)
    public_url: Mapped[Optional[str]] = mapped_column(Text)
    mime_type: Mapped[Optional[str]] = mapped_column(Text)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    duration_seconds: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    aspect_ratio: Mapped[Optional[str]] = mapped_column(Text)
    prompt_text: Mapped[Optional[str]] = mapped_column(Text)
    changes_summary: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    asset: Mapped["Asset"] = relationship(back_populates="versions")
