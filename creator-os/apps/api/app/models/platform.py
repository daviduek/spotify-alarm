"""Platform account model."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PlatformAccount(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "platform_accounts"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="SET NULL"), index=True
    )
    platform: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    provider_type: Mapped[str] = mapped_column(Text, nullable=False, default="buffer", index=True)
    display_name: Mapped[Optional[str]] = mapped_column(Text)
    handle: Mapped[Optional[str]] = mapped_column(Text)
    external_account_id: Mapped[Optional[str]] = mapped_column(Text)
    external_channel_id: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(Text)
    refresh_token_encrypted: Mapped[Optional[str]] = mapped_column(Text)
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    connected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
