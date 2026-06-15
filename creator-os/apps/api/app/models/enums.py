"""Application-level string enums matching the schema workflow states.

These are stored as plain VARCHAR columns (indexed) for Alpha simplicity, as
permitted by the schema spec. Validation happens at the Pydantic/service layer.
"""
from __future__ import annotations

from enum import StrEnum


class WorkspaceStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"


class CharacterStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class IdeaStatus(StrEnum):
    BACKLOG = "backlog"
    SELECTED = "selected"
    GENERATED = "generated"
    CONVERTED_TO_POST = "converted_to_post"
    ARCHIVED = "archived"


class AssetType(StrEnum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    OTHER = "other"


class AssetStatus(StrEnum):
    UPLOADED = "uploaded"
    GENERATED = "generated"
    SHORTLISTED = "shortlisted"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class AssetSourceType(StrEnum):
    GENERATED = "generated"
    UPLOADED = "uploaded"
    LICENSED = "licensed"
    EXTERNAL_TOOL = "external_tool"
    OTHER = "other"


class PostStatus(StrEnum):
    IDEA = "idea"
    GENERATED = "generated"
    ASSET_APPROVED = "asset_approved"
    POST_DRAFT = "post_draft"
    POST_APPROVED = "post_approved"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"
    MEASURED = "measured"
    ARCHIVED = "archived"


class PlatformType(StrEnum):
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    LINKTREE = "linktree"
    ONLYFANS = "onlyfans"
    FANVUE = "fanvue"
    FANSLY = "fansly"
    WEBSITE = "website"
    OTHER = "other"


class ProviderType(StrEnum):
    GOOGLE = "google"
    BUFFER = "buffer"
    POSTHOG = "posthog"
    S3 = "s3"
    MINIO = "minio"
    COMFYUI = "comfyui"
    MANUAL = "manual"
    MOCK = "mock"
    OTHER = "other"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GenerationJobType(StrEnum):
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_TO_IMAGE = "image_to_image"
    TEXT_TO_VIDEO = "text_to_video"
    IMAGE_TO_VIDEO = "image_to_video"
    CAPTION = "caption"
    PROMPT = "prompt"
    POST_PACKAGE = "post_package"


class PublishingJobStatus(StrEnum):
    QUEUED = "queued"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MetricSource(StrEnum):
    API = "api"
    MANUAL = "manual"
    TRACKING = "tracking"
    IMPORT = "import"
    ESTIMATED = "estimated"


class CampaignStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class TrackingLinkStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"
