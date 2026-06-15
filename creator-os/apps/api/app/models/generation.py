"""Generation job model."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GenerationJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "generation_jobs"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="SET NULL"), index=True
    )
    content_idea_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_ideas.id", ondelete="SET NULL")
    )
    prompt_template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_templates.id", ondelete="SET NULL")
    )
    job_type: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="queued", index=True)
    provider_type: Mapped[str] = mapped_column(Text, nullable=False, default="google", index=True)
    provider_model: Mapped[Optional[str]] = mapped_column(Text)
    prompt_text: Mapped[Optional[str]] = mapped_column(Text)
    negative_prompt_text: Mapped[Optional[str]] = mapped_column(Text)
    input_asset_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)
    input_reference_urls: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    requested_output_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    parameters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    provider_request: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    provider_response: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    external_job_id: Mapped[Optional[str]] = mapped_column(Text)
    error_code: Mapped[Optional[str]] = mapped_column(Text)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
