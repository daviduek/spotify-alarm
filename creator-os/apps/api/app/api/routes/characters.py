"""Character, identity profile, and content pillar routes."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_default_workspace
from app.models import Character, CharacterContentPillar, CharacterIdentityProfile
from app.schemas.character import (
    CharacterCreate,
    CharacterRead,
    CharacterUpdate,
    ContentPillarRead,
    ContentPillarsReplace,
    IdentityProfileRead,
    IdentityProfileUpdate,
)

router = APIRouter(tags=["characters"])


def _get_character(db: DbSession, character_id: UUID) -> Character:
    character = db.get(Character, character_id)
    if character is None:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.get("/characters", response_model=list[CharacterRead])
def list_characters(db: DbSession, _: CurrentUser) -> list[Character]:
    return list(db.scalars(select(Character).order_by(Character.created_at)))


@router.post("/characters", response_model=CharacterRead, status_code=201)
def create_character(payload: CharacterCreate, db: DbSession, _: CurrentUser) -> Character:
    workspace = get_default_workspace(db)
    character = Character(workspace_id=workspace.id, **payload.model_dump())
    db.add(character)
    db.commit()
    db.refresh(character)
    return character


@router.get("/characters/{character_id}", response_model=CharacterRead)
def get_character(character_id: UUID, db: DbSession, _: CurrentUser) -> Character:
    return _get_character(db, character_id)


@router.patch("/characters/{character_id}", response_model=CharacterRead)
def update_character(character_id: UUID, payload: CharacterUpdate, db: DbSession, _: CurrentUser) -> Character:
    character = _get_character(db, character_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(character, key, value)
    db.add(character)
    db.commit()
    db.refresh(character)
    return character


@router.get("/characters/{character_id}/identity", response_model=IdentityProfileRead)
def get_identity(character_id: UUID, db: DbSession, _: CurrentUser) -> CharacterIdentityProfile:
    profile = db.scalars(
        select(CharacterIdentityProfile).where(CharacterIdentityProfile.character_id == character_id)
    ).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Identity profile not found")
    return profile


@router.patch("/characters/{character_id}/identity", response_model=IdentityProfileRead)
def update_identity(
    character_id: UUID, payload: IdentityProfileUpdate, db: DbSession, _: CurrentUser
) -> CharacterIdentityProfile:
    profile = db.scalars(
        select(CharacterIdentityProfile).where(CharacterIdentityProfile.character_id == character_id)
    ).first()
    if profile is None:
        _get_character(db, character_id)
        profile = CharacterIdentityProfile(character_id=character_id)
        db.add(profile)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/characters/{character_id}/pillars", response_model=list[ContentPillarRead])
def get_pillars(character_id: UUID, db: DbSession, _: CurrentUser) -> list[CharacterContentPillar]:
    return list(
        db.scalars(
            select(CharacterContentPillar)
            .where(CharacterContentPillar.character_id == character_id)
            .order_by(CharacterContentPillar.weight_percent.desc())
        )
    )


@router.put("/characters/{character_id}/pillars", response_model=list[ContentPillarRead])
def replace_pillars(
    character_id: UUID, payload: ContentPillarsReplace, db: DbSession, _: CurrentUser
) -> list[CharacterContentPillar]:
    _get_character(db, character_id)
    existing = db.scalars(
        select(CharacterContentPillar).where(CharacterContentPillar.character_id == character_id)
    ).all()
    for pillar in existing:
        db.delete(pillar)
    new_pillars = [
        CharacterContentPillar(character_id=character_id, **pillar.model_dump()) for pillar in payload.pillars
    ]
    db.add_all(new_pillars)
    db.commit()
    return get_pillars(character_id, db, _)  # type: ignore[arg-type]
