"""Tracking link and event schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import ORMModel


class TrackingLinkCreate(BaseModel):
    character_id: Optional[UUID] = None
    campaign_id: Optional[UUID] = None
    post_id: Optional[UUID] = None
    slug: str
    target_url: str
    status: str = "active"
    default_utm_source: Optional[str] = None
    default_utm_medium: Optional[str] = None
    default_utm_campaign: Optional[str] = None
    default_utm_content: Optional[str] = None


class TrackingLinkRead(ORMModel):
    id: UUID
    workspace_id: UUID
    character_id: Optional[UUID] = None
    campaign_id: Optional[UUID] = None
    post_id: Optional[UUID] = None
    slug: str
    target_url: str
    status: str
    created_at: datetime


class TrackingEventRead(ORMModel):
    id: UUID
    tracking_link_id: UUID
    post_id: Optional[UUID] = None
    source_platform: Optional[str] = None
    utm_source: Optional[str] = None
    referrer: Optional[str] = None
    clicked_at: datetime
