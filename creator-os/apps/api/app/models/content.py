"""Content ideas and prompt templates."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ContentIdea(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "content_ideas"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), index=True
    )
    pillar_slug: Mapped[Optional[str]] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    objective: Mapped[Optional[str]] = mapped_column(Text)
    format: Mapped[Optional[str]] = mapped_column(Text)
    hook: Mapped[Optional[str]] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=3, index=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="backlog", index=True)
    suggested_platforms: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(Text, nullable=False, default="manual")
    generation_notes: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)


class PromptTemplate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "prompt_templates"
    __table_args__ = (UniqueConstraint("workspace_id", "slug", name="uq_prompt_templates_workspace_slug"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    template_type: Mapped[str] = mapped_column(Text, nullable=False, default="visual")
    pillar_slug: Mapped[Optional[str]] = mapped_column(Text)
    provider_type: Mapped[str] = mapped_column(Text, nullable=False, default="google")
    model_hint: Mapped[Optional[str]] = mapped_column(Text)
    prompt_body: Mapped[str] = mapped_column(Text, nullable=False)
    constraints_body: Mapped[Optional[str]] = mapped_column(Text)
    variables_schema: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    output_schema: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    default_parameters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
