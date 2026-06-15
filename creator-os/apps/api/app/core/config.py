"""Application configuration loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    secret_key: str = "change-me"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    # Database
    database_url: str = "postgresql+psycopg://creator_os:creator_os@localhost:5432/creator_os"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Storage
    storage_provider: str = "s3"
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key_id: str = "minioadmin"
    s3_secret_access_key: str = "minioadmin"
    s3_bucket: str = "creator-os-assets"
    s3_region: str = "us-east-1"
    s3_public_base_url: str = "http://localhost:9000/creator-os-assets"

    # Google generation
    google_api_key: str = ""
    google_image_model: str = ""
    google_video_model: str = ""

    # Buffer
    buffer_api_key: str = ""
    buffer_organization_id: str = ""

    # PostHog
    posthog_project_api_key: str = ""
    posthog_host: str = "https://us.i.posthog.com"

    # Tracking
    tracking_base_url: str = "http://localhost:8000/go"
    default_linktree_url: str = "https://linktr.ee/"

    # Operator seed
    admin_email: str = "admin@example.com"
    admin_password: str = "change-me"

    # Provider mode: "mock" or "real"
    generation_provider: str = "mock"
    publishing_provider: str = "mock"
    analytics_provider: str = "mock"

    # CORS
    cors_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
