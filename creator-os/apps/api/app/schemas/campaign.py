"""Campaign schemas."""
from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CampaignBase(BaseModel):
    character_id: Optional[UUID] = None
    name: str
    slug: str
    status: str = "draft"
    objective: Optional[str] = None
    hypothesis: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    settings: dict = Field(default_factory=dict)


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    objective: Optional[str] = None
    hypothesis: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    settings: Optional[dict] = None


class CampaignRead(ORMModel, CampaignBase):
    id: UUID
    workspace_id: UUID
