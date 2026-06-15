"""Google generation provider skeleton.

Real Google/Gemini/Imagen/Veo calls are intentionally NOT implemented in this
Alpha. This skeleton documents the interface and raises clearly if used without
the integration being completed. Use the mock provider for local development.
"""
from __future__ import annotations

from app.services.generation.base import GenerationProvider, GenerationResult


class GoogleGenerationProvider(GenerationProvider):
    def generate(self, *, job_type: str, prompt: str, count: int, parameters: dict) -> GenerationResult:
        raise NotImplementedError(
            "GoogleGenerationProvider is a skeleton. Set GENERATION_PROVIDER=mock for "
            "local development, or implement the Google/Gemini integration first."
        )
