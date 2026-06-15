"""Publishing provider interface."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Channel:
    external_channel_id: str
    platform: str
    display_name: str


@dataclass
class PublishResult:
    external_job_id: str
    external_post_id: str
    external_url: str | None
    status: str  # scheduled | published | failed
    provider_response: dict = field(default_factory=dict)


class PublishingProvider(ABC):
    @abstractmethod
    def list_channels(self) -> list[Channel]: ...

    @abstractmethod
    def schedule_post(
        self, *, platform: str, caption: str, asset_urls: list[str], scheduled_at: datetime | None
    ) -> PublishResult: ...

    @abstractmethod
    def get_post_status(self, external_post_id: str) -> str: ...
