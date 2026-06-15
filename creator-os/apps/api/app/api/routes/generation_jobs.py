"""Generation job routes (Alpha: mock provider, processed inline)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_default_workspace
from app.core.config import settings
from app.models import GenerationJob
from app.models.enums import JobStatus
from app.schemas.generation import GenerationJobCreate, GenerationJobRead
from app.services.generation_service import process_generation_job

router = APIRouter(tags=["generation"])


@router.get("/generation-jobs", response_model=list[GenerationJobRead])
def list_jobs(db: DbSession, _: CurrentUser) -> list[GenerationJob]:
    return list(db.scalars(select(GenerationJob).order_by(GenerationJob.created_at.desc())))


@router.post("/generation-jobs", response_model=GenerationJobRead, status_code=201)
def create_job(payload: GenerationJobCreate, db: DbSession, user: CurrentUser) -> GenerationJob:
    workspace = get_default_workspace(db)
    provider = payload.provider_type or settings.generation_provider
    job = GenerationJob(
        workspace_id=workspace.id,
        character_id=payload.character_id,
        content_idea_id=payload.content_idea_id,
        prompt_template_id=payload.prompt_template_id,
        job_type=payload.job_type,
        provider_type=provider,
        prompt_text=payload.prompt_text,
        requested_output_count=payload.requested_output_count,
        parameters=payload.parameters,
        created_by_user_id=user.id,
        status=JobStatus.QUEUED,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    # Alpha: process inline with the mock provider so the flow is observable.
    # A real worker (RQ/Celery) replaces this in Sprint 4.
    return process_generation_job(db, job)


@router.get("/generation-jobs/{job_id}", response_model=GenerationJobRead)
def get_job(job_id: UUID, db: DbSession, _: CurrentUser) -> GenerationJob:
    job = db.get(GenerationJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Generation job not found")
    return job


@router.post("/generation-jobs/{job_id}/cancel", response_model=GenerationJobRead)
def cancel_job(job_id: UUID, db: DbSession, _: CurrentUser) -> GenerationJob:
    job = db.get(GenerationJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Generation job not found")
    if job.status in (JobStatus.QUEUED, JobStatus.RUNNING):
        job.status = JobStatus.CANCELLED
        db.add(job)
        db.commit()
        db.refresh(job)
    return job
