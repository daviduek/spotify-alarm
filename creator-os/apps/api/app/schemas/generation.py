"""Generation job schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class GenerationJobCreate(BaseModel):
    character_id: Optional[UUID] = None
    content_idea_id: Optional[UUID] = None
    prompt_template_id: Optional[UUID] = None
    job_type: str = "text_to_image"
    provider_type: str = "mock"
    requested_output_count: int = 1
    prompt_text: Optional[str] = None
    parameters: dict = Field(default_factory=dict)


class GenerationJobRead(ORMModel):
    id: UUID
    workspace_id: UUID
    character_id: Optional[UUID] = None
    content_idea_id: Optional[UUID] = None
    prompt_template_id: Optional[UUID] = None
    job_type: str
    status: str
    provider_type: str
    provider_model: Optional[str] = None
    prompt_text: Optional[str] = None
    requested_output_count: int
    external_job_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
