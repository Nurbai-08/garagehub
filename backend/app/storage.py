import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from fastapi import HTTPException, UploadFile
from vercel.blob import AsyncBlobClient

from app.config import settings

ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@dataclass(frozen=True)
class StoredImage:
    location: str
    is_absolute_url: bool


class ImageStorage(Protocol):
    async def save(self, upload: UploadFile) -> StoredImage: ...


class LocalImageStorage:
    def __init__(self, root: str, max_size_mb: int | None = None) -> None:
        self.root = Path(root)
        self.max_size_mb = max_size_mb or settings.max_upload_size_mb
        self.root.mkdir(parents=True, exist_ok=True)

    async def save(self, upload: UploadFile) -> StoredImage:
        content, suffix, _ = await read_validated_image(upload, self.max_size_mb)
        filename = f"{uuid.uuid4().hex}{suffix}"
        try:
            (self.root / filename).write_bytes(content)
        except OSError as error:
            raise HTTPException(status_code=503, detail="Не удалось сохранить изображение") from error
        return StoredImage(location=filename, is_absolute_url=False)


class VercelBlobImageStorage:
    def __init__(self, token: str, max_size_mb: int | None = None) -> None:
        self.token = token
        self.max_size_mb = max_size_mb or settings.max_upload_size_mb

    async def save(self, upload: UploadFile) -> StoredImage:
        content, suffix, content_type = await read_validated_image(upload, self.max_size_mb)
        pathname = f"cars/{uuid.uuid4().hex}{suffix}"
        try:
            async with AsyncBlobClient(token=self.token) as client:
                uploaded = await client.put(
                    pathname,
                    content,
                    access="public",
                    content_type=content_type,
                    add_random_suffix=False,
                    cache_control_max_age=31_536_000,
                )
        except Exception as error:
            raise HTTPException(status_code=503, detail="Облачное хранилище временно недоступно") from error
        return StoredImage(location=uploaded.url, is_absolute_url=True)


async def read_validated_image(upload: UploadFile, max_size_mb: int) -> tuple[bytes, str, str]:
    content_type = upload.content_type or ""
    suffix = ALLOWED_TYPES.get(content_type)
    if suffix is None:
        raise HTTPException(status_code=422, detail="Поддерживаются только JPG, PNG и WebP")
    max_bytes = max_size_mb * 1024 * 1024
    content = await upload.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Размер изображения не должен превышать {max_size_mb} MB")
    if not content:
        raise HTTPException(status_code=422, detail="Файл изображения пуст")
    signatures = {
        ".jpg": content.startswith(b"\xff\xd8\xff"),
        ".png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        ".webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    }
    if not signatures[suffix]:
        raise HTTPException(status_code=422, detail="Содержимое файла не соответствует формату изображения")
    return content, suffix, content_type


def create_image_storage() -> ImageStorage:
    if settings.resolved_image_storage_backend == "vercel_blob":
        if not settings.blob_read_write_token:
            raise RuntimeError("BLOB_READ_WRITE_TOKEN is required for Vercel Blob storage")
        return VercelBlobImageStorage(settings.blob_read_write_token)
    return LocalImageStorage(settings.upload_dir)


image_storage = create_image_storage()
