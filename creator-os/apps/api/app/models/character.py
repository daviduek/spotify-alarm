"""Character, identity profile, content pillars, and reference assets."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Character(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "characters"
    __table_args__ = (UniqueConstraint("workspace_id", "slug", name="uq_characters_workspace_slug"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft", index=True)
    market: Mapped[str] = mapped_column(Text, nullable=False, default="USA")
    language: Mapped[str] = mapped_column(Text, nullable=False, default="English")
    city_base: Mapped[Optional[str]] = mapped_column(Text)
    secondary_cities: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    age_apparent: Mapped[Optional[int]] = mapped_column(Integer)
    archetype: Mapped[Optional[str]] = mapped_column(Text)
    profession_strategy: Mapped[Optional[str]] = mapped_column(Text)
    public_bio: Mapped[Optional[str]] = mapped_column(Text)
    narrative_summary: Mapped[Optional[str]] = mapped_column(Text)
    personality_traits: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    tone_rules: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    content_strategy: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    identity_profile: Mapped[Optional["CharacterIdentityProfile"]] = relationship(
        back_populates="character", uselist=False, cascade="all, delete-orphan"
    )
    content_pillars: Mapped[list["CharacterContentPillar"]] = relationship(
        back_populates="character", cascade="all, delete-orphan"
    )


class CharacterIdentityProfile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "character_identity_profiles"

    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    face_description: Mapped[Optional[str]] = mapped_column(Text)
    body_description: Mapped[Optional[str]] = mapped_column(Text)
    hair_description: Mapped[Optional[str]] = mapped_column(Text)
    skin_tone_description: Mapped[Optional[str]] = mapped_column(Text)
    makeup_style: Mapped[Optional[str]] = mapped_column(Text)
    wardrobe_style: Mapped[Optional[str]] = mapped_column(Text)
    luxury_level: Mapped[Optional[str]] = mapped_column(Text)
    travel_style: Mapped[Optional[str]] = mapped_column(Text)
    visual_aesthetic: Mapped[Optional[str]] = mapped_column(Text)
    prompt_anchor: Mapped[Optional[str]] = mapped_column(Text)
    negative_identity_constraints: Mapped[Optional[str]] = mapped_column(Text)
    forbidden_variations: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    visual_qc_notes: Mapped[Optional[str]] = mapped_column(Text)
    identity_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    character: Mapped["Character"] = relationship(back_populates="identity_profile")


class CharacterContentPillar(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "character_content_pillars"
    __table_args__ = (UniqueConstraint("character_id", "slug", name="uq_pillars_character_slug"),)

    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    weight_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    description: Mapped[Optional[str]] = mapped_column(Text)
    examples: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)

    character: Mapped["Character"] = relationship(back_populates="content_pillars")


class CharacterReferenceAsset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "character_reference_assets"
    __table_args__ = (
        UniqueConstraint("character_id", "asset_id", "reference_type", name="uq_reference_character_asset_type"),
    )

    character_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[Optional[str]] = mapped_column(Text)
    reference_type: Mapped[str] = mapped_column(Text, nullable=False, default="golden_reference")
    weight: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=1.0)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
