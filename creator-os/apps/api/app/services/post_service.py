"""Post workflow service: approval and scheduling gates (schema section 5)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Asset, Post, PostAsset, PublishingJob
from app.models.enums import AssetStatus, PostStatus, PublishingJobStatus
from app.services.errors import ValidationError


def approve_post(db: Session, post: Post, user_id: uuid.UUID) -> Post:
    """Approve a post only if every attached asset is approved (rule 5.2)."""
    for pa in post.post_assets:
        if pa.asset.status != AssetStatus.APPROVED:
            raise ValidationError("All post assets must be approved before approving the post.")

    post.status = PostStatus.POST_APPROVED
    post.approved_at = datetime.now(timezone.utc)
    post.approved_by_user_id = user_id
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def schedule_post(db: Session, post: Post, scheduled_at: datetime | None, user_id: uuid.UUID) -> PublishingJob:
    """Create a publishing job only for approved posts (rule 5.1)."""
    if post.status not in (PostStatus.POST_APPROVED, PostStatus.SCHEDULED):
        raise ValidationError("Post must be approved before publishing or scheduling.")

    when = scheduled_at or post.scheduled_at
    if when is not None:
        post.scheduled_at = when

    job = PublishingJob(
        workspace_id=post.workspace_id,
        post_id=post.id,
        platform_account_id=post.platform_account_id,
        provider_type="mock",
        status=PublishingJobStatus.QUEUED,
        scheduled_at=when,
        created_by_user_id=user_id,
    )
    post.status = PostStatus.SCHEDULED
    db.add_all([post, job])
    db.commit()
    db.refresh(job)
    return job


def attach_asset(db: Session, post: Post, asset: Asset, role: str = "primary", sort_order: int = 0) -> PostAsset:
    link = PostAsset(post_id=post.id, asset_id=asset.id, role=role, sort_order=sort_order)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link
