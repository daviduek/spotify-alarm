"""Tracking link CRUD, public redirect, and event listing."""
from __future__ import annotations

import hashlib
from urllib.parse import urlencode, urlparse, urlunparse
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_default_workspace
from app.models import TrackingEvent, TrackingLink
from app.schemas.tracking import TrackingEventRead, TrackingLinkCreate, TrackingLinkRead

router = APIRouter(tags=["tracking"])


@router.get("/tracking-links", response_model=list[TrackingLinkRead])
def list_links(db: DbSession, _: CurrentUser) -> list[TrackingLink]:
    return list(db.scalars(select(TrackingLink).order_by(TrackingLink.created_at.desc())))


@router.post("/tracking-links", response_model=TrackingLinkRead, status_code=201)
def create_link(payload: TrackingLinkCreate, db: DbSession, _: CurrentUser) -> TrackingLink:
    workspace = get_default_workspace(db)
    link = TrackingLink(workspace_id=workspace.id, **payload.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.get("/tracking-events", response_model=list[TrackingEventRead])
def list_events(db: DbSession, _: CurrentUser, tracking_link_id: UUID | None = None) -> list[TrackingEvent]:
    stmt = select(TrackingEvent).order_by(TrackingEvent.clicked_at.desc()).limit(500)
    if tracking_link_id:
        stmt = stmt.where(TrackingEvent.tracking_link_id == tracking_link_id)
    return list(db.scalars(stmt))


def _with_utm(url: str, params: dict[str, str]) -> str:
    clean = {k: v for k, v in params.items() if v}
    if not clean:
        return url
    parsed = urlparse(url)
    query = urlencode(clean)
    new_query = f"{parsed.query}&{query}" if parsed.query else query
    return urlunparse(parsed._replace(query=new_query))


# Public, unauthenticated redirect endpoint. Must never fail the redirect
# because of a non-critical analytics write (schema rule 5.4).
@router.get("/go/{slug}")
def redirect(slug: str, request: Request, db: DbSession) -> RedirectResponse:
    link = db.scalars(
        select(TrackingLink).where(TrackingLink.slug == slug, TrackingLink.status == "active")
    ).first()
    if link is None:
        raise HTTPException(status_code=404, detail="Tracking link not found")

    qp = request.query_params
    target = _with_utm(
        link.target_url,
        {
            "utm_source": qp.get("utm_source") or link.default_utm_source or "",
            "utm_medium": qp.get("utm_medium") or link.default_utm_medium or "",
            "utm_campaign": qp.get("utm_campaign") or link.default_utm_campaign or "",
            "utm_content": qp.get("utm_content") or link.default_utm_content or "",
        },
    )

    try:
        client_ip = request.client.host if request.client else ""
        ip_hash = hashlib.sha256(client_ip.encode()).hexdigest() if client_ip else None
        event = TrackingEvent(
            workspace_id=link.workspace_id,
            tracking_link_id=link.id,
            character_id=link.character_id,
            campaign_id=link.campaign_id,
            post_id=link.post_id,
            source_platform=qp.get("utm_source"),
            utm_source=qp.get("utm_source") or link.default_utm_source,
            utm_medium=qp.get("utm_medium") or link.default_utm_medium,
            utm_campaign=qp.get("utm_campaign") or link.default_utm_campaign,
            utm_content=qp.get("utm_content") or link.default_utm_content,
            referrer=request.headers.get("referer"),
            user_agent=request.headers.get("user-agent"),
            ip_hash=ip_hash,
        )
        db.add(event)
        db.commit()
    except Exception:  # noqa: BLE001  -- never block the redirect on analytics failure
        db.rollback()

    return RedirectResponse(url=target, status_code=302)
