"""Post routes: CRUD, approve, schedule."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_default_workspace
from app.models import Asset, Post
from app.schemas.post import PostCreate, PostRead, PostUpdate, ScheduleRequest
from app.services import post_service
from app.services.errors import ValidationError

router = APIRouter(tags=["posts"])


def _get_post(db: DbSession, post_id: UUID) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.get("/posts", response_model=list[PostRead])
def list_posts(
    db: DbSession, _: CurrentUser, character_id: UUID | None = None, status: str | None = None
) -> list[Post]:
    stmt = select(Post).order_by(Post.created_at.desc())
    if character_id:
        stmt = stmt.where(Post.character_id == character_id)
    if status:
        stmt = stmt.where(Post.status == status)
    return list(db.scalars(stmt))


@router.post("/posts", response_model=PostRead, status_code=201)
def create_post(payload: PostCreate, db: DbSession, user: CurrentUser) -> Post:
    workspace = get_default_workspace(db)
    data = payload.model_dump(exclude={"asset_ids"})
    post = Post(workspace_id=workspace.id, created_by_user_id=user.id, **data)
    db.add(post)
    db.flush()
    for idx, asset_id in enumerate(payload.asset_ids):
        asset = db.get(Asset, asset_id)
        if asset is None:
            raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")
        post_service.attach_asset(db, post, asset, sort_order=idx)
    db.commit()
    db.refresh(post)
    return post


@router.get("/posts/{post_id}", response_model=PostRead)
def get_post(post_id: UUID, db: DbSession, _: CurrentUser) -> Post:
    return _get_post(db, post_id)


@router.patch("/posts/{post_id}", response_model=PostRead)
def update_post(post_id: UUID, payload: PostUpdate, db: DbSession, _: CurrentUser) -> Post:
    post = _get_post(db, post_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, key, value)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.post("/posts/{post_id}/approve", response_model=PostRead)
def approve_post(post_id: UUID, db: DbSession, user: CurrentUser) -> Post:
    post = _get_post(db, post_id)
    try:
        return post_service.approve_post(db, post, user.id)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/posts/{post_id}/schedule", response_model=PostRead)
def schedule_post(post_id: UUID, payload: ScheduleRequest, db: DbSession, user: CurrentUser) -> Post:
    post = _get_post(db, post_id)
    try:
        post_service.schedule_post(db, post, payload.scheduled_at, user.id)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.refresh(post)
    return post
