"""Dashboard summary and minimal analytics overview."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.models import Asset, Character, Post, PostMetric
from app.models.enums import AssetStatus, PostStatus

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary")
def summary(db: DbSession, _: CurrentUser) -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    next_7 = now + timedelta(days=7)
    last_7 = now - timedelta(days=7)

    active_character = db.scalars(
        select(Character).where(Character.status == "active").order_by(Character.created_at)
    ).first()

    def count(stmt) -> int:
        return db.scalar(stmt) or 0

    assets_today = count(
        select(func.count(Asset.id)).where(Asset.created_at >= today_start)
    )
    assets_awaiting = count(
        select(func.count(Asset.id)).where(Asset.status.in_([AssetStatus.GENERATED, AssetStatus.UPLOADED, AssetStatus.SHORTLISTED]))
    )
    posts_awaiting = count(
        select(func.count(Post.id)).where(Post.status == PostStatus.POST_DRAFT)
    )
    scheduled_next_7 = count(
        select(func.count(Post.id)).where(
            Post.status == PostStatus.SCHEDULED, Post.scheduled_at >= now, Post.scheduled_at <= next_7
        )
    )
    published_last_7 = count(
        select(func.count(Post.id)).where(
            Post.status.in_([PostStatus.PUBLISHED, PostStatus.MEASURED]), Post.published_at >= last_7
        )
    )
    total_views = count(select(func.coalesce(func.sum(PostMetric.views), 0)))
    total_clicks = count(select(func.coalesce(func.sum(PostMetric.link_clicks), 0)))

    return {
        "active_character": {"id": str(active_character.id), "name": active_character.name}
        if active_character
        else None,
        "assets_generated_today": assets_today,
        "assets_awaiting_approval": assets_awaiting,
        "posts_awaiting_approval": posts_awaiting,
        "scheduled_next_7_days": scheduled_next_7,
        "published_last_7_days": published_last_7,
        "total_views": total_views,
        "total_link_clicks": total_clicks,
    }


@router.get("/analytics/overview")
def analytics_overview(db: DbSession, _: CurrentUser, character_id: UUID | None = None) -> dict:
    character = (
        db.get(Character, character_id)
        if character_id
        else db.scalars(select(Character).where(Character.status == "active")).first()
    )
    totals = db.execute(
        select(
            func.coalesce(func.sum(PostMetric.views), 0),
            func.coalesce(func.sum(PostMetric.profile_visits), 0),
            func.coalesce(func.sum(PostMetric.link_clicks), 0),
            func.coalesce(func.sum(PostMetric.followers_gained), 0),
        )
    ).one()
    views, profile_visits, link_clicks, followers = totals
    return {
        "character": {"id": str(character.id), "name": character.name} if character else None,
        "period": "last_30_days",
        "totals": {
            "posts_published": 0,
            "views": int(views),
            "profile_visits": int(profile_visits),
            "link_clicks": int(link_clicks),
            "followers_gained": int(followers),
        },
        "rates": {
            "profile_visit_rate": (profile_visits / views) if views else 0,
            "profile_to_link_ctr": (link_clicks / profile_visits) if profile_visits else 0,
        },
        "best_posts": [],
        "performance_by_pillar": [],
    }
