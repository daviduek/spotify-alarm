"""Post schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class PostBase(BaseModel):
    character_id: UUID
    campaign_id: Optional[UUID] = None
    content_idea_id: Optional[UUID] = None
    platform: str = "instagram"
    status: str = "post_draft"
    title: Optional[str] = None
    caption: Optional[str] = None
    hashtags: list[str] = Field(default_factory=list)
    cta: Optional[str] = None
    pillar_slug: Optional[str] = None
    format: Optional[str] = None
    hook_type: Optional[str] = None
    caption_type: Optional[str] = None
    asset_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class PostCreate(PostBase):
    asset_ids: list[UUID] = Field(default_factory=list)


class PostUpdate(BaseModel):
    campaign_id: Optional[UUID] = None
    platform: Optional[str] = None
    title: Optional[str] = None
    caption: Optional[str] = None
    hashtags: Optional[list[str]] = None
    cta: Optional[str] = None
    pillar_slug: Optional[str] = None
    format: Optional[str] = None
    hook_type: Optional[str] = None
    caption_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class PostRead(ORMModel):
    id: UUID
    workspace_id: UUID
    character_id: UUID
    campaign_id: Optional[UUID] = None
    content_idea_id: Optional[UUID] = None
    platform: str
    status: str
    title: Optional[str] = None
    caption: Optional[str] = None
    hashtags: list[str] = Field(default_factory=list)
    cta: Optional[str] = None
    pillar_slug: Optional[str] = None
    format: Optional[str] = None
    hook_type: Optional[str] = None
    caption_type: Optional[str] = None
    asset_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    external_post_id: Optional[str] = None
    external_url: Optional[str] = None
    tracking_link_id: Optional[UUID] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime


class ScheduleRequest(BaseModel):
    scheduled_at: Optional[datetime] = None
