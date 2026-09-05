import asyncio
import os

import pytest

pytestmark = [pytest.mark.anyio, pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="Requires PostgreSQL row locks")]


async def test_concurrent_favorites_and_ratings_keep_exact_counts(audit_api):
    owner = await audit_api.member("owner")
    first = await audit_api.member("first")
    second = await audit_api.member("second")
    car = await audit_api.car(owner)
    path = f"/api/v1/cars/{car['id']}"
    responses = await asyncio.gather(first.put(f"{path}/favorite"), first.put(f"{path}/favorite"), second.put(f"{path}/favorite"))
    assert [response.status_code for response in responses] == [204, 204, 204]
    assert (await owner.get(path)).json()["favorites_count"] == 2
    responses = await asyncio.gather(first.put(f"{path}/rating", json={"score": 8}), second.put(f"{path}/rating", json={"score": 10}))
    assert all(response.status_code == 200 for response in responses)
    saved = (await owner.get(path)).json()
    assert saved["rating_count"] == 2 and saved["rating_avg"] == 9


async def test_concurrent_conversation_starts_reuse_one_dialog(audit_api):
    owner = await audit_api.member("owner")
    other = await audit_api.member("other")
    car = await audit_api.car(owner)
    path = f"/api/v1/cars/{car['id']}/conversation"
    responses = await asyncio.gather(other.post(path), other.post(path))
    assert all(response.status_code == 200 for response in responses)
    assert responses[0].json()["id"] == responses[1].json()["id"]


async def test_refresh_token_can_only_be_rotated_once(audit_api):
    member = await audit_api.member("owner")
    first = await audit_api.client()
    second = await audit_api.client()
    headers = {"Cookie": f"refresh_token={member.cookies.get('refresh_token')}"}
    responses = await asyncio.gather(first.post("/api/v1/auth/refresh", headers=headers), second.post("/api/v1/auth/refresh", headers=headers))
    assert sorted(response.status_code for response in responses) == [200, 401]
