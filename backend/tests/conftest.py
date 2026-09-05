import os
import uuid
from contextlib import AsyncExitStack
from io import BytesIO

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import get_session
from app.main import app
from app.models import Base


@pytest.fixture
def anyio_backend():
    return "asyncio"


class AuditAPI:
    def __init__(self, sessions, stack):
        self.sessions = sessions
        self.stack = stack

    async def client(self):
        return await self.stack.enter_async_context(AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        ))

    async def member(self, name):
        client = await self.client()
        response = await client.post("/api/v1/auth/register", json={
            "email": f"{name}@example.com", "username": name, "password": "AuditPass123!",
        })
        assert response.status_code == 201, response.text
        client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
        return client

    async def car(self, client, **overrides):
        response = await client.post("/api/v1/cars", json={
            "brand": "BMW", "model": "M3", "year": 2022,
            "cover_image_url": "/uploads/a.jpg", "image_urls": ["/uploads/a.jpg"],
            **overrides,
        })
        assert response.status_code == 201, response.text
        return response.json()


@pytest.fixture
async def audit_api(tmp_path, monkeypatch):
    database_url = os.getenv("TEST_DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'audit.db'}")
    engine = create_async_engine(database_url)
    schema = f"audit_{uuid.uuid4().hex}"
    if engine.dialect.name == "sqlite":
        @event.listens_for(engine.sync_engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
    else:
        async with engine.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = engine.execution_options(schema_translate_map={None: schema})
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def test_session():
        async with sessions() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_session, test_session)
    monkeypatch.setattr(app, "middleware_stack", None)
    try:
        async with AsyncExitStack() as stack:
            yield AuditAPI(sessions, stack)
    finally:
        if engine.dialect.name != "sqlite":
            async with engine.begin() as connection:
                await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await engine.dispose()


@pytest.fixture
def png_bytes():
    buffer = BytesIO()
    Image.new("RGB", (2, 2), (20, 80, 120)).save(buffer, format="PNG")
    return buffer.getvalue()
