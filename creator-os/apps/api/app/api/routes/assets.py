"""Asset routes: CRUD, upload, approve/reject, versions, create-post."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_default_workspace
from app.models import Asset, AssetVersion, Post
from app.models.enums import AssetStatus, PostStatus
from app.schemas.asset import (
    AssetCreate,
    AssetRead,
    AssetRejectRequest,
    AssetUpdate,
    AssetVersionRead,
    CreatePostFromAssetRequest,
)
from app.schemas.post import PostRead
from app.services import post_service
from app.services.storage import get_storage_provider

router = APIRouter(tags=["assets"])


def _get_asset(db: DbSession, asset_id: UUID) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.get("/assets", response_model=list[AssetRead])
def list_assets(
    db: DbSession,
    _: CurrentUser,
    character_id: UUID | None = None,
    status: str | None = None,
    asset_type: str | None = None,
) -> list[Asset]:
    stmt = select(Asset).order_by(Asset.created_at.desc())
    if character_id:
        stmt = stmt.where(Asset.character_id == character_id)
    if status:
        stmt = stmt.where(Asset.status == status)
    if asset_type:
        stmt = stmt.where(Asset.asset_type == asset_type)
    return list(db.scalars(stmt))


@router.post("/assets", response_model=AssetRead, status_code=201)
def create_asset(payload: AssetCreate, db: DbSession, user: CurrentUser) -> Asset:
    workspace = get_default_workspace(db)
    data = payload.model_dump()
    data["metadata_"] = data.pop("metadata")
    asset = Asset(workspace_id=workspace.id, created_by_user_id=user.id, **data)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/assets/upload", response_model=AssetRead, status_code=201)
async def upload_asset(
    db: DbSession,
    user: CurrentUser,
    file: UploadFile = File(...),
    character_id: UUID | None = Form(None),
    asset_type: str = Form("image"),
    title: str | None = Form(None),
) -> Asset:
    workspace = get_default_workspace(db)
    contents = await file.read()
    key = f"uploads/{workspace.id}/{uuid4()}-{file.filename}"
    storage = get_storage_provider()
    stored = storage.upload(key, contents, file.content_type or "application/octet-stream")

    asset = Asset(
        workspace_id=workspace.id,
        character_id=character_id,
        created_by_user_id=user.id,
        asset_type=asset_type,
        source_type="uploaded",
        status=AssetStatus.UPLOADED,
        title=title or file.filename,
        storage_key=stored.storage_key,
        public_url=stored.public_url,
        mime_type=stored.mime_type,
        file_size_bytes=stored.size_bytes,
    )
    db.add(asset)
    db.flush()
    db.add(
        AssetVersion(
            asset_id=asset.id,
            version_number=1,
            storage_key=stored.storage_key,
            public_url=stored.public_url,
            mime_type=stored.mime_type,
            file_size_bytes=stored.size_bytes,
            changes_summary="Initial upload",
            created_by_user_id=user.id,
        )
    )
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/assets/{asset_id}", response_model=AssetRead)
def get_asset(asset_id: UUID, db: DbSession, _: CurrentUser) -> Asset:
    return _get_asset(db, asset_id)


@router.patch("/assets/{asset_id}", response_model=AssetRead)
def update_asset(asset_id: UUID, payload: AssetUpdate, db: DbSession, _: CurrentUser) -> Asset:
    asset = _get_asset(db, asset_id)
    data = payload.model_dump(exclude_unset=True)
    if "metadata" in data:
        data["metadata_"] = data.pop("metadata")
    for key, value in data.items():
        setattr(asset, key, value)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/assets/{asset_id}/approve", response_model=AssetRead)
def approve_asset(asset_id: UUID, db: DbSession, _: CurrentUser) -> Asset:
    asset = _get_asset(db, asset_id)
    asset.status = AssetStatus.APPROVED
    asset.approved_at = datetime.now(timezone.utc)
    asset.rejected_at = None
    asset.rejection_reason = None
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/assets/{asset_id}/reject", response_model=AssetRead)
def reject_asset(asset_id: UUID, payload: AssetRejectRequest, db: DbSession, _: CurrentUser) -> Asset:
    asset = _get_asset(db, asset_id)
    asset.status = AssetStatus.REJECTED
    asset.rejected_at = datetime.now(timezone.utc)
    asset.rejection_reason = payload.reason
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/assets/{asset_id}/versions", response_model=list[AssetVersionRead])
def get_versions(asset_id: UUID, db: DbSession, _: CurrentUser) -> list[AssetVersion]:
    _get_asset(db, asset_id)
    return list(
        db.scalars(
            select(AssetVersion)
            .where(AssetVersion.asset_id == asset_id)
            .order_by(AssetVersion.version_number)
        )
    )


@router.post("/assets/{asset_id}/create-post", response_model=PostRead, status_code=201)
def create_post_from_asset(
    asset_id: UUID, payload: CreatePostFromAssetRequest, db: DbSession, user: CurrentUser
) -> Post:
    asset = _get_asset(db, asset_id)
    if asset.status != AssetStatus.APPROVED and not payload.allow_draft_from_unapproved:
        raise HTTPException(
            status_code=422,
            detail="Asset is not approved. Pass allow_draft_from_unapproved=true to draft anyway.",
        )

    post = Post(
        workspace_id=asset.workspace_id,
        character_id=asset.character_id,
        campaign_id=payload.campaign_id,
        platform=payload.platform,
        status=PostStatus.POST_DRAFT,
        caption=payload.caption,
        asset_type=asset.asset_type,
        scheduled_at=payload.scheduled_at,
        utm_source=payload.platform,
        utm_medium="social",
        utm_campaign="sasha_alpha",
        created_by_user_id=user.id,
    )
    db.add(post)
    db.flush()
    post.utm_content = f"post_{post.id}"
    post_service.attach_asset(db, post, asset)
    db.refresh(post)
    return post
