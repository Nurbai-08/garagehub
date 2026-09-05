import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import get_session
from app.main import app, community_messages, create_car, create_community_message, update_car
from app.models import Base, CarImage, User
from app.schemas import CarCreate, CarUpdate, MessageCreate
from app.security import current_user, hash_password
from app.storage import LocalImageStorage


async def make_session(database_path: str):
    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False)()


async def make_user(session):
    user = User(
        email="gallery@example.com",
        username="gallery_owner",
        password_hash=hash_password("GarageHub123!"),
    )
    session.add(user)
    await session.commit()
    return user


@pytest.mark.anyio
async def test_upload_then_create_and_edit_single_photo_car(tmp_path, monkeypatch, png_bytes) -> None:
    engine, session = await make_session(str(tmp_path / "upload.db"))
    storage = LocalImageStorage(str(tmp_path / "images"))
    monkeypatch.setattr("app.main.image_storage", storage)
    async with session:
        user = await make_user(session)

        async def test_session():
            yield session

        monkeypatch.setitem(app.dependency_overrides, current_user, lambda: user)
        monkeypatch.setitem(app.dependency_overrides, get_session, test_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            upload = await client.post("/api/v1/uploads/images", files={"file": ("car.png", png_bytes, "image/png")})
            assert upload.status_code == 200
            url = upload.json()["url"]
            assert list(storage.root.glob("*.png"))
            created = await client.post("/api/v1/cars", json={"brand": "BMW", "model": "M3", "year": 2022, "cover_image_url": url, "image_urls": [url]})
            assert created.status_code == 201, created.text
            car_id = created.json()["id"]
            edited = await client.patch(f"/api/v1/cars/{car_id}", json={"model": "M3 Competition", "image_urls": [url]})
            assert edited.status_code == 200, edited.text
            fetched = await client.get(f"/api/v1/cars/{car_id}")
            assert fetched.json()["image_urls"] == [url]
            assert fetched.json()["cover_image_url"] == url
            assert fetched.json()["model"] == "M3 Competition"
    await engine.dispose()


@pytest.mark.anyio
async def test_create_and_update_car_gallery(tmp_path) -> None:
    engine, session = await make_session(str(tmp_path / "gallery.db"))
    async with session:
        user = await make_user(session)
        created = await create_car(
            CarCreate(
                brand="BMW",
                model="M3",
                year=2022,
                cover_image_url="/uploads/one.webp",
                image_urls=[
                    "/uploads/one.webp",
                    "/uploads/two.webp",
                    "/uploads/three.webp",
                ],
            ),
            user,
            session,
        )

        assert created.image_urls == [
            "/uploads/one.webp",
            "/uploads/two.webp",
            "/uploads/three.webp",
        ]

        updated = await update_car(
            created.id,
            CarUpdate(
                image_urls=[
                    "/uploads/new-one.webp",
                    "/uploads/new-two.webp",
                    "/uploads/new-three.webp",
                ]
            ),
            user,
            session,
        )

        assert updated.cover_image_url == "/uploads/new-one.webp"
        assert updated.image_urls == [
            "/uploads/new-one.webp",
            "/uploads/new-two.webp",
            "/uploads/new-three.webp",
        ]
        remaining_url = "/uploads/new-two.webp"
        reduced = await update_car(created.id, CarUpdate(image_urls=[remaining_url]), user, session)
        assert reduced.cover_image_url == remaining_url
        assert reduced.image_urls == [remaining_url]
        persisted = await session.scalars(select(CarImage.image_url).where(CarImage.car_id == created.id))
        assert list(persisted) == [remaining_url]
    await engine.dispose()


@pytest.mark.anyio
async def test_car_rejects_external_image_urls(tmp_path) -> None:
    engine, session = await make_session(str(tmp_path / "external-image.db"))
    async with session:
        user = await make_user(session)
        with pytest.raises(HTTPException, match="загруженное через Гараж"):
            await create_car(
                CarCreate(
                    brand="BMW",
                    model="M3",
                    year=2022,
                    cover_image_url="https://tracker.example/m3.jpg",
                    image_urls=[
                        "https://tracker.example/m3.jpg",
                        "https://tracker.example/m3-side.jpg",
                        "https://tracker.example/m3-back.jpg",
                    ],
                ),
                user,
                session,
            )
    await engine.dispose()


@pytest.mark.anyio
async def test_community_messages_are_shared_with_all_users(tmp_path) -> None:
    engine, session = await make_session(str(tmp_path / "community.db"))
    async with session:
        user = await make_user(session)
        created = await create_community_message(MessageCreate(content="Кто видел сегодня красивый Nissan Z?"), user, session)
        messages = await community_messages(user, session)

        assert created.sender_username == user.username
        assert [message.content for message in messages] == [created.content]
    await engine.dispose()
