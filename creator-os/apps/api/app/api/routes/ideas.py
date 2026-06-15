"""Content idea routes."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_default_workspace
from app.models import ContentIdea
from app.schemas.content import ContentIdeaCreate, ContentIdeaRead, ContentIdeaUpdate

router = APIRouter(tags=["ideas"])


def _get_idea(db: DbSession, idea_id: UUID) -> ContentIdea:
    idea = db.get(ContentIdea, idea_id)
    if idea is None:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea


@router.get("/ideas", response_model=list[ContentIdeaRead])
def list_ideas(db: DbSession, _: CurrentUser, character_id: UUID | None = None) -> list[ContentIdea]:
    stmt = select(ContentIdea).order_by(ContentIdea.priority, ContentIdea.created_at.desc())
    if character_id:
        stmt = stmt.where(ContentIdea.character_id == character_id)
    return list(db.scalars(stmt))


@router.post("/ideas", response_model=ContentIdeaRead, status_code=201)
def create_idea(payload: ContentIdeaCreate, db: DbSession, _: CurrentUser) -> ContentIdea:
    workspace = get_default_workspace(db)
    data = payload.model_dump()
    data["metadata_"] = data.pop("metadata")
    idea = ContentIdea(workspace_id=workspace.id, **data)
    db.add(idea)
    db.commit()
    db.refresh(idea)
    return idea


@router.get("/ideas/{idea_id}", response_model=ContentIdeaRead)
def get_idea(idea_id: UUID, db: DbSession, _: CurrentUser) -> ContentIdea:
    return _get_idea(db, idea_id)


@router.patch("/ideas/{idea_id}", response_model=ContentIdeaRead)
def update_idea(idea_id: UUID, payload: ContentIdeaUpdate, db: DbSession, _: CurrentUser) -> ContentIdea:
    idea = _get_idea(db, idea_id)
    data = payload.model_dump(exclude_unset=True)
    if "metadata" in data:
        data["metadata_"] = data.pop("metadata")
    for key, value in data.items():
        setattr(idea, key, value)
    db.add(idea)
    db.commit()
    db.refresh(idea)
    return idea
