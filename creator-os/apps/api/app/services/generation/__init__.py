"""Generation provider factory."""
from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.services.generation.base import (
    GenerationOutput,
    GenerationProvider,
    GenerationResult,
)
from app.services.generation.mock_provider import MockGenerationProvider

__all__ = [
    "GenerationOutput",
    "GenerationProvider",
    "GenerationResult",
    "get_generation_provider",
]


@lru_cache
def get_generation_provider() -> GenerationProvider:
    if settings.generation_provider == "google":
        from app.services.generation.google_provider import GoogleGenerationProvider

        return GoogleGenerationProvider()
    return MockGenerationProvider()
