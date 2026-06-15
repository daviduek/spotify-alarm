"""Mock generation provider. Does not call any external API."""
from __future__ import annotations

import uuid

from app.core.config import settings
from app.services.generation.base import GenerationOutput, GenerationProvider, GenerationResult


class MockGenerationProvider(GenerationProvider):
    """Returns deterministic placeholder asset metadata for local development."""

    def generate(self, *, job_type: str, prompt: str, count: int, parameters: dict) -> GenerationResult:
        is_video = "video" in job_type
        mime = "video/mp4" if is_video else "image/png"
        ext = "mp4" if is_video else "png"
        aspect = parameters.get("aspect_ratio", "9:16")
        width, height = (1080, 1920) if aspect == "9:16" else (1080, 1080)

        outputs: list[GenerationOutput] = []
        for _ in range(max(1, count)):
            key = f"generated/mock/{uuid.uuid4()}.{ext}"
            outputs.append(
                GenerationOutput(
                    storage_key=key,
                    public_url=f"{settings.s3_public_base_url}/{key}",
                    mime_type=mime,
                    width=width,
                    height=height,
                    aspect_ratio=aspect,
                    metadata={"mock": True, "prompt_preview": prompt[:140]},
                )
            )

        return GenerationResult(
            external_job_id=f"mock-{uuid.uuid4()}",
            provider_model="mock-image-1" if not is_video else "mock-video-1",
            outputs=outputs,
            provider_response={"status": "completed", "mock": True, "count": len(outputs)},
        )
