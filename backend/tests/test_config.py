import pytest
from pydantic import ValidationError

from app.config import Settings


def test_postgres_url_is_normalized_for_psycopg() -> None:
    configured = Settings(database_url="postgresql://user:pass@example.com/db", _env_file=None)
    assert configured.database_url == "postgresql+psycopg://user:pass@example.com/db"


def test_vercel_rejects_ephemeral_storage_configuration() -> None:
    with pytest.raises(ValidationError, match="Vercel requires BLOB_READ_WRITE_TOKEN"):
        Settings(
            vercel="1",
            database_url="postgresql://user:pass@example.com/db",
            jwt_secret="x" * 32,
            image_storage_backend="local",
            backend_cors_origins="https://garage.example",
            allowed_hosts="garage.example",
            _env_file=None,
        )


def test_vercel_accepts_persistent_services() -> None:
    configured = Settings(
        vercel="1",
        database_url="postgresql://user:pass@example.com/db",
        jwt_secret="x" * 32,
        blob_read_write_token="vercel_blob_rw_token",
        backend_cors_origins="https://garage.example",
        allowed_hosts="garage.example",
        allowed_image_hosts="example.public.blob.vercel-storage.com",
        _env_file=None,
    )
    assert configured.resolved_image_storage_backend == "vercel_blob"


def test_production_rejects_the_development_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="Production requires a unique JWT_SECRET"):
        Settings(
            environment="production",
            backend_cors_origins="https://garage.example",
            allowed_hosts="garage.example",
            _env_file=None,
        )
