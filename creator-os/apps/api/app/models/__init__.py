"""SQLAlchemy models package. Import all models so metadata is fully populated."""
from app.models.base import Base
from app.models.workspace import Workspace, User
from app.models.character import (
    Character,
    CharacterIdentityProfile,
    CharacterContentPillar,
    CharacterReferenceAsset,
)
from app.models.campaign import Campaign
from app.models.content import ContentIdea, PromptTemplate
from app.models.generation import GenerationJob
from app.models.asset import Asset, AssetVersion
from app.models.platform import PlatformAccount
from app.models.post import Post, PostAsset, PublishingJob
from app.models.tracking import TrackingLink, TrackingEvent
from app.models.metrics import PostMetric, DailyCharacterMetric
from app.models.misc import MonetizationLink, IntegrationConnection, AuditEvent

__all__ = [
    "Base",
    "Workspace",
    "User",
    "Character",
    "CharacterIdentityProfile",
    "CharacterContentPillar",
    "CharacterReferenceAsset",
    "Campaign",
    "ContentIdea",
    "PromptTemplate",
    "GenerationJob",
    "Asset",
    "AssetVersion",
    "PlatformAccount",
    "Post",
    "PostAsset",
    "PublishingJob",
    "TrackingLink",
    "TrackingEvent",
    "PostMetric",
    "DailyCharacterMetric",
    "MonetizationLink",
    "IntegrationConnection",
    "AuditEvent",
]
