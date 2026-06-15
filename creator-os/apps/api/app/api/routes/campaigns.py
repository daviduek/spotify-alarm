"""Campaign routes."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, get_default_workspace
from app.models import Campaign
from app.schemas.campaign import CampaignCreate, CampaignRead, CampaignUpdate

router = APIRouter(tags=["campaigns"])


def _get_campaign(db: DbSession, campaign_id: UUID) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.get("/campaigns", response_model=list[CampaignRead])
def list_campaigns(db: DbSession, _: CurrentUser) -> list[Campaign]:
    return list(db.scalars(select(Campaign).order_by(Campaign.created_at.desc())))


@router.post("/campaigns", response_model=CampaignRead, status_code=201)
def create_campaign(payload: CampaignCreate, db: DbSession, _: CurrentUser) -> Campaign:
    workspace = get_default_workspace(db)
    campaign = Campaign(workspace_id=workspace.id, **payload.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/campaigns/{campaign_id}", response_model=CampaignRead)
def get_campaign(campaign_id: UUID, db: DbSession, _: CurrentUser) -> Campaign:
    return _get_campaign(db, campaign_id)


@router.patch("/campaigns/{campaign_id}", response_model=CampaignRead)
def update_campaign(campaign_id: UUID, payload: CampaignUpdate, db: DbSession, _: CurrentUser) -> Campaign:
    campaign = _get_campaign(db, campaign_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign
