"""Prompt template routes."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_default_workspace
from app.models import PromptTemplate
from app.schemas.content import PromptTemplateCreate, PromptTemplateRead, PromptTemplateUpdate

router = APIRouter(tags=["prompt-templates"])


def _get_template(db: DbSession, template_id: UUID) -> PromptTemplate:
    template = db.get(PromptTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return template


@router.get("/prompt-templates", response_model=list[PromptTemplateRead])
def list_templates(db: DbSession, _: CurrentUser) -> list[PromptTemplate]:
    return list(db.scalars(select(PromptTemplate).order_by(PromptTemplate.name)))


@router.post("/prompt-templates", response_model=PromptTemplateRead, status_code=201)
def create_template(payload: PromptTemplateCreate, db: DbSession, _: CurrentUser) -> PromptTemplate:
    workspace = get_default_workspace(db)
    template = PromptTemplate(workspace_id=workspace.id, **payload.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/prompt-templates/{template_id}", response_model=PromptTemplateRead)
def get_template(template_id: UUID, db: DbSession, _: CurrentUser) -> PromptTemplate:
    return _get_template(db, template_id)


@router.patch("/prompt-templates/{template_id}", response_model=PromptTemplateRead)
def update_template(
    template_id: UUID, payload: PromptTemplateUpdate, db: DbSession, _: CurrentUser
) -> PromptTemplate:
    template = _get_template(db, template_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template
