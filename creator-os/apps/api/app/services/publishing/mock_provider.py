"""Mock publishing provider. Does not call Buffer."""
from __future__ import annotations

import uuid
from datetime import datetime

from app.services.publishing.base import Channel, PublishingProvider, PublishResult


class MockPublishingProvider(PublishingProvider):
    def list_channels(self) -> list[Channel]:
        return [
            Channel(external_channel_id="mock-ig", platform="instagram", display_name="Sasha Van (IG mock)"),
            Channel(external_channel_id="mock-tt", platform="tiktok", display_name="Sasha Van (TikTok mock)"),
        ]

    def schedule_post(
        self, *, platform: str, caption: str, asset_urls: list[str], scheduled_at: datetime | None
    ) -> PublishResult:
        external_post_id = f"mock-post-{uuid.uuid4()}"
        status = "scheduled" if scheduled_at else "published"
        return PublishResult(
            external_job_id=f"mock-job-{uuid.uuid4()}",
            external_post_id=external_post_id,
            external_url=f"https://mock.local/{platform}/{external_post_id}",
            status=status,
            provider_response={"mock": True, "platform": platform, "asset_count": len(asset_urls)},
        )

    def get_post_status(self, external_post_id: str) -> str:
        return "published"
