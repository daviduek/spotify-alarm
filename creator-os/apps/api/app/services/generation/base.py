"""Generation provider interface."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class GenerationOutput:
    storage_key: str
    public_url: str
    mime_type: str
    width: int | None = None
    height: int | None = None
    aspect_ratio: str | None = None
    metadata: dict = field(default_factory=dict)


@dataclass
class GenerationResult:
    external_job_id: str
    provider_model: str
    outputs: list[GenerationOutput]
    provider_response: dict = field(default_factory=dict)


class GenerationProvider(ABC):
    @abstractmethod
    def generate(self, *, job_type: str, prompt: str, count: int, parameters: dict) -> GenerationResult: ...
