"""Storage provider interface."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class StoredObject:
    storage_key: str
    public_url: str
    size_bytes: int
    mime_type: str


class StorageProvider(ABC):
    @abstractmethod
    def upload(self, key: str, data: bytes, mime_type: str) -> StoredObject: ...

    @abstractmethod
    def get_signed_url(self, storage_key: str, expires_in: int = 3600) -> str: ...

    @abstractmethod
    def delete(self, storage_key: str) -> None: ...
