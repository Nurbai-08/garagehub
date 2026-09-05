from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_JWT_SECRET = "development_only_change_me_please"


class Settings(BaseSettings):
    app_name: str = "Гараж API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://garagehub:change_me@localhost:5432/garagehub"
    jwt_secret: str = INSECURE_JWT_SECRET
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    backend_cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 4
    image_storage_backend: Literal["auto", "local", "vercel_blob"] = "auto"
    blob_read_write_token: str | None = None
    vercel: str | None = None
    vercel_env: str | None = None
    allowed_hosts: str = "localhost,127.0.0.1,testserver,backend"
    allowed_image_hosts: str = Field(
        default="localhost,127.0.0.1,testserver,backend",
        validation_alias="ALLOWED_IMAGE_HOSTS",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [value.strip() for value in self.backend_cors_origins.split(",") if value.strip()]

    @property
    def trusted_hosts(self) -> list[str]:
        return [value.strip() for value in self.allowed_hosts.split(",") if value.strip()]

    @property
    def trusted_image_hosts(self) -> set[str]:
        return {value.strip().lower() for value in self.allowed_image_hosts.split(",") if value.strip()}

    @property
    def is_vercel(self) -> bool:
        return self.vercel == "1"

    @property
    def is_production(self) -> bool:
        return self.environment == "production" or self.vercel_env == "production"

    @property
    def resolved_image_storage_backend(self) -> Literal["local", "vercel_blob"]:
        if self.image_storage_backend != "auto":
            return self.image_storage_backend
        return "vercel_blob" if self.blob_read_write_token else "local"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @model_validator(mode="after")
    def validate_vercel_configuration(self) -> "Settings":
        is_hosted = self.is_production or self.is_vercel
        if is_hosted and (self.jwt_secret == INSECURE_JWT_SECRET or len(self.jwt_secret) < 32):
            raise ValueError("Production requires a unique JWT_SECRET of at least 32 characters")
        if is_hosted and (not self.trusted_hosts or "*" in self.trusted_hosts):
            raise ValueError("Production requires explicit ALLOWED_HOSTS")
        if is_hosted and (not self.cors_origins or any(origin == "*" or origin.startswith("http://") for origin in self.cors_origins)):
            raise ValueError("Production requires explicit HTTPS BACKEND_CORS_ORIGINS")
        if not self.is_vercel:
            return self
        if self.resolved_image_storage_backend != "vercel_blob":
            raise ValueError("Vercel requires BLOB_READ_WRITE_TOKEN and Vercel Blob storage")
        if self.database_url.startswith("sqlite") or "localhost" in self.database_url or "@db:" in self.database_url:
            raise ValueError("Vercel requires an external PostgreSQL DATABASE_URL")
        if not self.trusted_image_hosts:
            raise ValueError("Vercel requires ALLOWED_IMAGE_HOSTS for Vercel Blob")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
