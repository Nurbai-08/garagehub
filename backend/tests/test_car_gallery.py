import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.main import community_messages, create_car, create_community_message, update_car
from app.models import Base, User
from app.schemas import CarCreate, CarUpdate, MessageCreate
from app.security import hash_password


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
