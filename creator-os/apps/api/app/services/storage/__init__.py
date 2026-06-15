"""Storage provider factory."""
from __future__ import annotations

from functools import lru_cache

from app.services.storage.base import StorageProvider, StoredObject
from app.services.storage.s3_provider import S3StorageProvider

__all__ = ["StorageProvider", "StoredObject", "get_storage_provider"]


@lru_cache
def get_storage_provider() -> StorageProvider:
    # Only an S3-compatible provider is wired for Alpha (MinIO locally).
    return S3StorageProvider()
