from urllib.parse import urlparse

from fastapi import HTTPException

from app.config import settings


def validate_image_urls(urls: list[str]) -> None:
    for url in urls:
        if not is_trusted_image_url(url):
            raise HTTPException(status_code=422, detail="Используйте изображение, загруженное через Гараж")


def is_trusted_image_url(value: str) -> bool:
    if value.startswith(("/uploads/", "/assets/")):
        return True
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and parsed.hostname is not None and any(host_matches(parsed.hostname, pattern) for pattern in settings.trusted_image_hosts)


def host_matches(host: str, pattern: str) -> bool:
    if pattern.startswith("*."):
        suffix = pattern[2:]
        return host == suffix or host.endswith(f".{suffix}")
    return host == pattern
