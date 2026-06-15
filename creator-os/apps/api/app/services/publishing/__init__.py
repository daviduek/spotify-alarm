"""Publishing provider factory."""
from __future__ import annotations

from functools import lru_cache

from app.services.publishing.base import Channel, PublishingProvider, PublishResult
from app.services.publishing.mock_provider import MockPublishingProvider

__all__ = ["Channel", "PublishingProvider", "PublishResult", "get_publishing_provider"]


@lru_cache
def get_publishing_provider() -> PublishingProvider:
    # Buffer provider is a future P1 task; only the mock is wired for Alpha.
    return MockPublishingProvider()
