import asyncio

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Car, User
from app.security import hash_password

USERS = [
    ("demo@example.com", "northdrive", "Александр Норт"),
    ("michael@example.com", "michael_k", "Михаил Ким"),
    ("classic@example.com", "oldschool_garage", "Oldschool Garage"),
    ("anna@example.com", "anna_moves", "Анна Лебедева"),
    ("nomad@example.com", "nomad_motor", "Nomad Motor Club"),
]

async def seed() -> None:
    async with SessionLocal() as session:
        if await session.scalar(select(func.count(User.id))):
            print("Seed skipped: database already contains users")
            return

        users = [User(email=email, username=username, display_name=name, password_hash=hash_password("GarageHub123!")) for email, username, name in USERS]
        session.add_all(users)
        await session.flush()
        session.add(
            Car(
                owner_id=users[0].id,
                brand="BMW",
                model="5 Series",
                generation="G30",
                trim="540i",
                year=2019,
                power_hp=340,
                drivetrain="AWD",
                mileage=140_000,
                cover_image_url="/assets/bmw-g30.jpg",
                description="Моя любимая BMW G30. Особенно хороша в вечерних поездках с друзьями.",
                is_public=True,
            )
        )

        await session.commit()
        print("Demo accounts and BMW G30 created")


if __name__ == "__main__":
    asyncio.run(seed())
