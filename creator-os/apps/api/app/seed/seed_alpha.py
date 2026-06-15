"""Idempotent seed for the Creator OS Alpha workspace, admin user, and Sasha Van."""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import (
    Character,
    CharacterContentPillar,
    CharacterIdentityProfile,
    PromptTemplate,
    TrackingLink,
    User,
    Workspace,
)
from app.seed.templates import PROMPT_TEMPLATES

SASHA = {
    "name": "Sasha Van",
    "slug": "sasha-van",
    "status": "active",
    "market": "USA",
    "language": "English",
    "city_base": "Miami, Florida",
    "secondary_cities": ["New York", "Los Angeles", "Las Vegas"],
    "age_apparent": 27,
    "archetype": "Luxury travel lifestyle businesswoman",
    "profession_strategy": "Ambiguous founder/investor/private deals narrative. Never fully explained.",
    "public_bio": "Private life. Public discipline. Miami / NYC.",
    "narrative_summary": (
        "Sasha lives between luxury travel, private meetings, hotels, airport runs, rooftops, "
        "disciplined routines, and selective access. Her work is implied, not explained."
    ),
    "personality_traits": ["selective", "disciplined", "aspirational", "mysterious", "high-status"],
    "tone_rules": {
        "voice": "short, confident, selective, mysterious",
        "avoid": ["needy", "desperate", "generic influencer tone", "overexplaining"],
        "phrases": [
            "Private life. Public discipline.",
            "Out of town. Still on schedule.",
            "Some meetings are better left private.",
            "Not unavailable. Just selective.",
            "Quiet moves. Loud results.",
            "The view is better after the work is done.",
        ],
    },
    "content_strategy": {
        "primary_goal": "validate traffic and repeatable formats",
        "initial_platforms": ["instagram", "tiktok"],
        "content_style": "luxury travel, nightlife, hotel, airport, Miami/NYC energy",
        "posting_rule": "minimum 2 pieces per day during validation",
    },
}

IDENTITY = {
    "face_description": "To be finalized in Identity Lab after golden references are selected.",
    "body_description": "Fit, luxury lifestyle, high-status aesthetic. Final proportions to be locked after golden references.",
    "hair_description": "To be finalized.",
    "skin_tone_description": "To be finalized.",
    "makeup_style": "Polished luxury, camera-ready, not overdone.",
    "wardrobe_style": "Luxury travel, fitted dresses, airport outfits, resort wear, premium athleisure.",
    "luxury_level": "High",
    "travel_style": "Miami, NYC, airports, hotels, rooftops, suites, cars, resort mornings.",
    "visual_aesthetic": "Modern luxury, warm night lights, glass, marble, premium travel, private life energy.",
    "prompt_anchor": (
        "Sasha Van, luxury travel lifestyle businesswoman, Miami-based, selective and mysterious, "
        "premium hotel and airport lifestyle aesthetic."
    ),
    "negative_identity_constraints": (
        "Avoid changing apparent age, face structure, hair style, body type, makeup style, "
        "or luxury positioning between generations."
    ),
    "forbidden_variations": [
        "different apparent age",
        "different face structure",
        "cheap influencer aesthetic",
        "low-quality lighting",
        "inconsistent hair",
        "cartoonish proportions",
        "visible text artifacts",
        "random logos",
    ],
}

PILLARS = [
    {
        "name": "Travel Luxury",
        "slug": "travel_luxury",
        "weight_percent": Decimal(40),
        "description": "Airports, hotels, destination hints, private travel, luxury movement.",
        "examples": ["airport fit", "hotel suite", "Miami balcony", "NYC arrival"],
    },
    {
        "name": "Luxury Night Lifestyle",
        "slug": "luxury_night_lifestyle",
        "weight_percent": Decimal(25),
        "description": "Rooftops, dinners, cars, city lights, elegant after-hours.",
        "examples": ["rooftop after hours", "black dress mirror", "night car", "private dinner"],
    },
    {
        "name": "Fitness Premium",
        "slug": "fitness_premium",
        "weight_percent": Decimal(15),
        "description": "Premium gym, discipline, morning routine, body as habit.",
        "examples": ["hotel gym", "morning run", "post-workout", "premium athleisure"],
    },
    {
        "name": "Business Mystery",
        "slug": "business_mystery",
        "weight_percent": Decimal(10),
        "description": "Private calls, laptop, deal notes, coworking, meetings without context.",
        "examples": ["private call", "laptop in cafe", "deal notes", "meeting lobby"],
    },
    {
        "name": "Private Hints",
        "slug": "private_hints",
        "weight_percent": Decimal(10),
        "description": "Humanizing private details without making Sasha too available.",
        "examples": ["Sunday reset", "coffee", "playlist", "packing"],
    },
]


def _get_or_create(db: Session, model, defaults: dict | None = None, **lookup):
    instance = db.scalars(select(model).filter_by(**lookup)).first()
    if instance:
        return instance, False
    params = {**lookup, **(defaults or {})}
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance, True


def run_seed() -> dict:
    db = SessionLocal()
    created: dict[str, bool] = {}
    try:
        workspace, c = _get_or_create(
            db, Workspace, slug="creator-os-alpha", defaults={"name": "Creator OS Alpha", "status": "active"}
        )
        created["workspace"] = c

        user, c = _get_or_create(
            db,
            User,
            email=settings.admin_email,
            defaults={
                "workspace_id": workspace.id,
                "password_hash": hash_password(settings.admin_password),
                "full_name": "Operator",
                "role": "admin",
                "status": "active",
            },
        )
        created["admin_user"] = c

        character, c = _get_or_create(
            db, Character, workspace_id=workspace.id, slug=SASHA["slug"], defaults={**SASHA, "workspace_id": workspace.id}
        )
        created["sasha"] = c

        profile = db.scalars(
            select(CharacterIdentityProfile).where(CharacterIdentityProfile.character_id == character.id)
        ).first()
        if profile is None:
            db.add(CharacterIdentityProfile(character_id=character.id, **IDENTITY))
            created["identity_profile"] = True
        else:
            created["identity_profile"] = False

        for pillar in PILLARS:
            _, c = _get_or_create(
                db,
                CharacterContentPillar,
                character_id=character.id,
                slug=pillar["slug"],
                defaults={**pillar, "character_id": character.id},
            )

        for tpl in PROMPT_TEMPLATES:
            _, c = _get_or_create(
                db,
                PromptTemplate,
                workspace_id=workspace.id,
                slug=tpl["slug"],
                defaults={
                    "workspace_id": workspace.id,
                    "character_id": character.id,
                    "name": tpl["name"],
                    "pillar_slug": tpl.get("pillar_slug"),
                    "template_type": "visual",
                    "provider_type": "google",
                    "prompt_body": tpl["prompt_body"],
                    "is_active": True,
                },
            )

        _get_or_create(
            db,
            TrackingLink,
            workspace_id=workspace.id,
            slug="sasha",
            defaults={
                "workspace_id": workspace.id,
                "character_id": character.id,
                "target_url": settings.default_linktree_url or "https://linktr.ee/",
                "status": "active",
                "default_utm_source": "instagram",
                "default_utm_medium": "social",
                "default_utm_campaign": "sasha_alpha",
            },
        )

        db.commit()
        return {"ok": True, "created": created, "workspace_id": str(workspace.id), "character_id": str(character.id)}
    finally:
        db.close()


if __name__ == "__main__":
    result = run_seed()
    print(result)
