"""S3 / MinIO compatible storage provider."""
from __future__ import annotations

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings
from app.services.storage.base import StorageProvider, StoredObject


class S3StorageProvider(StorageProvider):
    def __init__(self) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )
        self._bucket = settings.s3_bucket

    def ensure_bucket(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError:
            self._client.create_bucket(Bucket=self._bucket)

    def upload(self, key: str, data: bytes, mime_type: str) -> StoredObject:
        self.ensure_bucket()
        self._client.put_object(Bucket=self._bucket, Key=key, Body=data, ContentType=mime_type)
        return StoredObject(
            storage_key=key,
            public_url=f"{settings.s3_public_base_url}/{key}",
            size_bytes=len(data),
            mime_type=mime_type,
        )

    def get_signed_url(self, storage_key: str, expires_in: int = 3600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": storage_key},
            ExpiresIn=expires_in,
        )

    def delete(self, storage_key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=storage_key)
