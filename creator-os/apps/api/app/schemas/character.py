"""Character, identity profile, and content pillar schemas."""
from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CharacterBase(BaseModel):
    name: str
    slug: str
    status: str = "draft"
    market: str = "USA"
    language: str = "English"
    city_base: Optional[str] = None
    secondary_cities: list[str] = Field(default_factory=list)
    age_apparent: Optional[int] = None
    archetype: Optional[str] = None
    profession_strategy: Optional[str] = None
    public_bio: Optional[str] = None
    narrative_summary: Optional[str] = None
    personality_traits: list[str] = Field(default_factory=list)
    tone_rules: dict = Field(default_factory=dict)
    content_strategy: dict = Field(default_factory=dict)
    notes: Optional[str] = None


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    market: Optional[str] = None
    language: Optional[str] = None
    city_base: Optional[str] = None
    secondary_cities: Optional[list[str]] = None
    age_apparent: Optional[int] = None
    archetype: Optional[str] = None
    profession_strategy: Optional[str] = None
    public_bio: Optional[str] = None
    narrative_summary: Optional[str] = None
    personality_traits: Optional[list[str]] = None
    tone_rules: Optional[dict] = None
    content_strategy: Optional[dict] = None
    notes: Optional[str] = None


class CharacterRead(ORMModel, CharacterBase):
    id: UUID
    workspace_id: UUID


class IdentityProfileBase(BaseModel):
    face_description: Optional[str] = None
    body_description: Optional[str] = None
    hair_description: Optional[str] = None
    skin_tone_description: Optional[str] = None
    makeup_style: Optional[str] = None
    wardrobe_style: Optional[str] = None
    luxury_level: Optional[str] = None
    travel_style: Optional[str] = None
    visual_aesthetic: Optional[str] = None
    prompt_anchor: Optional[str] = None
    negative_identity_constraints: Optional[str] = None
    forbidden_variations: list[str] = Field(default_factory=list)
    visual_qc_notes: Optional[str] = None
    identity_metadata: dict = Field(default_factory=dict)


class IdentityProfileUpdate(BaseModel):
    face_description: Optional[str] = None
    body_description: Optional[str] = None
    hair_description: Optional[str] = None
    skin_tone_description: Optional[str] = None
    makeup_style: Optional[str] = None
    wardrobe_style: Optional[str] = None
    luxury_level: Optional[str] = None
    travel_style: Optional[str] = None
    visual_aesthetic: Optional[str] = None
    prompt_anchor: Optional[str] = None
    negative_identity_constraints: Optional[str] = None
    forbidden_variations: Optional[list[str]] = None
    visual_qc_notes: Optional[str] = None
    identity_metadata: Optional[dict] = None


class IdentityProfileRead(ORMModel, IdentityProfileBase):
    id: UUID
    character_id: UUID


class ContentPillarBase(BaseModel):
    name: str
    slug: str
    weight_percent: Decimal = Decimal(0)
    description: Optional[str] = None
    examples: list[str] = Field(default_factory=list)


class ContentPillarRead(ORMModel, ContentPillarBase):
    id: UUID
    character_id: UUID


class ContentPillarsReplace(BaseModel):
    pillars: list[ContentPillarBase]
