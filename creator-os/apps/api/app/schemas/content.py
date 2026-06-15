"""Content idea and prompt template schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ContentIdeaBase(BaseModel):
    character_id: UUID
    campaign_id: Optional[UUID] = None
    pillar_slug: Optional[str] = None
    title: str
    description: Optional[str] = None
    objective: Optional[str] = None
    format: Optional[str] = None
    hook: Optional[str] = None
    priority: int = 3
    status: str = "backlog"
    suggested_platforms: list[str] = Field(default_factory=list)
    scheduled_for: Optional[datetime] = None
    source: str = "manual"
    generation_notes: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class ContentIdeaCreate(ContentIdeaBase):
    pass


class ContentIdeaUpdate(BaseModel):
    campaign_id: Optional[UUID] = None
    pillar_slug: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    objective: Optional[str] = None
    format: Optional[str] = None
    hook: Optional[str] = None
    priority: Optional[int] = None
    status: Optional[str] = None
    suggested_platforms: Optional[list[str]] = None
    scheduled_for: Optional[datetime] = None
    generation_notes: Optional[str] = None
    metadata: Optional[dict] = None


class ContentIdeaRead(ORMModel):
    id: UUID
    workspace_id: UUID
    character_id: UUID
    campaign_id: Optional[UUID] = None
    pillar_slug: Optional[str] = None
    title: str
    description: Optional[str] = None
    objective: Optional[str] = None
    format: Optional[str] = None
    hook: Optional[str] = None
    priority: int
    status: str
    suggested_platforms: list[str] = Field(default_factory=list)
    scheduled_for: Optional[datetime] = None
    source: str
    generation_notes: Optional[str] = None
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_", serialization_alias="metadata")


class PromptTemplateBase(BaseModel):
    character_id: Optional[UUID] = None
    name: str
    slug: str
    description: Optional[str] = None
    template_type: str = "visual"
    pillar_slug: Optional[str] = None
    provider_type: str = "google"
    model_hint: Optional[str] = None
    prompt_body: str
    constraints_body: Optional[str] = None
    variables_schema: dict = Field(default_factory=dict)
    output_schema: dict = Field(default_factory=dict)
    default_parameters: dict = Field(default_factory=dict)
    is_active: bool = True


class PromptTemplateCreate(PromptTemplateBase):
    pass


class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    template_type: Optional[str] = None
    pillar_slug: Optional[str] = None
    provider_type: Optional[str] = None
    model_hint: Optional[str] = None
    prompt_body: Optional[str] = None
    constraints_body: Optional[str] = None
    variables_schema: Optional[dict] = None
    output_schema: Optional[dict] = None
    default_parameters: Optional[dict] = None
    is_active: Optional[bool] = None


class PromptTemplateRead(ORMModel, PromptTemplateBase):
    id: UUID
    workspace_id: UUID
