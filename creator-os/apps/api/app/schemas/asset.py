"""Asset and asset version schemas."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class AssetCreate(BaseModel):
    character_id: Optional[UUID] = None
    campaign_id: Optional[UUID] = None
    asset_type: str = "image"
    source_type: str = "uploaded"
    status: str = "uploaded"
    title: Optional[str] = None
    description: Optional[str] = None
    provider_type: Optional[str] = None
    provider_model: Optional[str] = None
    original_prompt: Optional[str] = None
    storage_key: Optional[str] = None
    public_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[Decimal] = None
    width: Optional[int] = None
    height: Optional[int] = None
    aspect_ratio: Optional[str] = None
    platform_fit: list[str] = Field(default_factory=list)
    risk_recommendation: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class AssetUpdate(BaseModel):
    character_id: Optional[UUID] = None
    campaign_id: Optional[UUID] = None
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    platform_fit: Optional[list[str]] = None
    risk_recommendation: Optional[str] = None
    tags: Optional[list[str]] = None
    metadata: Optional[dict] = None


class AssetRead(ORMModel):
    id: UUID
    workspace_id: UUID
    character_id: Optional[UUID] = None
    campaign_id: Optional[UUID] = None
    generation_job_id: Optional[UUID] = None
    asset_type: str
    source_type: str
    status: str
    title: Optional[str] = None
    description: Optional[str] = None
    provider_type: Optional[str] = None
    provider_model: Optional[str] = None
    original_prompt: Optional[str] = None
    storage_key: Optional[str] = None
    public_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[Decimal] = None
    width: Optional[int] = None
    height: Optional[int] = None
    aspect_ratio: Optional[str] = None
    platform_fit: list[str] = Field(default_factory=list)
    risk_recommendation: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_", serialization_alias="metadata")
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime


class AssetVersionRead(ORMModel):
    id: UUID
    asset_id: UUID
    version_number: int
    storage_key: Optional[str] = None
    public_url: Optional[str] = None
    mime_type: Optional[str] = None
    prompt_text: Optional[str] = None
    changes_summary: Optional[str] = None
    created_at: datetime


class AssetRejectRequest(BaseModel):
    reason: Optional[str] = None


class CreatePostFromAssetRequest(BaseModel):
    platform: str = "instagram"
    campaign_id: Optional[UUID] = None
    caption: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    allow_draft_from_unapproved: bool = False
