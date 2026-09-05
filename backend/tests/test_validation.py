import uuid
from datetime import timedelta
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from pydantic import ValidationError
from starlette.datastructures import Headers

from app.image_urls import host_matches
from app.schemas import CarCreate, CarUpdate, RegisterInput
from app.security import create_token, hash_password, verify_password
from app.storage import LocalImageStorage, VercelBlobImageStorage


class FakeBlobResult:
    url = "https://example.public.blob.vercel-storage.com/cars/test.png"


class FakeBlobClient:
    def __init__(self) -> None:
        self.pathname = ""

    async def __aenter__(self) -> "FakeBlobClient":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def put(self, pathname: str, *args: object, **kwargs: object) -> FakeBlobResult:
        self.pathname = pathname
        return FakeBlobResult()


def test_password_is_hashed_and_verifiable() -> None:
    hashed = hash_password("GarageHub123!")
    assert hashed != "GarageHub123!"
    assert verify_password("GarageHub123!", hashed)
    assert not verify_password("wrong-password", hashed)


def test_tokens_created_in_the_same_second_are_unique() -> None:
    user_id = uuid.uuid4()
    assert create_token(user_id, "refresh", timedelta(days=30)) != create_token(user_id, "refresh", timedelta(days=30))


def test_image_host_wildcard_only_matches_subdomains() -> None:
    pattern = "*.public.blob.vercel-storage.com"
    assert host_matches("garage.public.blob.vercel-storage.com", pattern)
    assert not host_matches("public.blob.vercel-storage.com.evil.example", pattern)


def test_username_validation_rejects_spaces_and_cyrillic() -> None:
    with pytest.raises(ValidationError):
        RegisterInput(email="owner@example.com", username="мой гараж", password="GarageHub123!")


def test_car_validation_rejects_negative_mileage() -> None:
    with pytest.raises(ValidationError):
        CarCreate(
            brand="BMW",
            model="M3",
            year=2022,
            mileage=-1,
            cover_image_url="https://example.com/m3.jpg",
            image_urls=[
                "https://example.com/m3.jpg",
                "https://example.com/m3-side.jpg",
                "https://example.com/m3-back.jpg",
            ],
        )


@pytest.mark.parametrize("count", [1, 2, 5])
def test_car_validation_accepts_one_to_five_gallery_images(count: int) -> None:
    urls = [f"/uploads/{index}.jpg" for index in range(count)]
    car = CarCreate(brand="BMW", model="M3", year=2022, cover_image_url=urls[0], image_urls=urls)
    assert car.image_urls == urls
    assert CarUpdate(image_urls=urls).image_urls == urls


@pytest.mark.parametrize("count", [0, 6])
def test_car_validation_rejects_empty_or_oversized_gallery(count: int) -> None:
    urls = [f"/uploads/{index}.jpg" for index in range(count)]
    with pytest.raises(ValidationError):
        CarCreate(
            brand="BMW",
            model="M3",
            year=2022,
            cover_image_url="https://example.com/m3.jpg",
            image_urls=urls,
        )
    with pytest.raises(ValidationError):
        CarUpdate(image_urls=urls)


@pytest.mark.anyio
async def test_image_storage_validates_content_signature(tmp_path) -> None:
    storage = LocalImageStorage(str(tmp_path))
    fake_png = UploadFile(file=BytesIO(b"not a png"), filename="fake.png", headers=Headers({"content-type": "image/png"}))
    with pytest.raises(HTTPException) as error:
        await storage.save(fake_png)
    assert error.value.status_code == 422


@pytest.mark.anyio
async def test_image_storage_accepts_real_png_signature(tmp_path, png_bytes) -> None:
    storage = LocalImageStorage(str(tmp_path))
    png = UploadFile(file=BytesIO(png_bytes), filename="cover.png", headers=Headers({"content-type": "image/png"}))
    stored = await storage.save(png)
    assert stored.location.endswith(".png")
    assert not stored.is_absolute_url
    assert (tmp_path / stored.location).exists()


@pytest.mark.anyio
async def test_blob_storage_returns_permanent_url(monkeypatch, png_bytes) -> None:
    client = FakeBlobClient()
    monkeypatch.setattr("app.storage.AsyncBlobClient", lambda **kwargs: client)
    storage = VercelBlobImageStorage("test-token")
    png = UploadFile(file=BytesIO(png_bytes), filename="cover.png", headers=Headers({"content-type": "image/png"}))

    stored = await storage.save(png)

    assert stored.location == FakeBlobResult.url
    assert stored.is_absolute_url
    assert client.pathname.startswith("cars/")
    assert client.pathname.endswith(".png")
