import uuid

import pytest
from sqlalchemy import select

from app.models import User

pytestmark = pytest.mark.anyio


async def test_private_car_is_visible_only_to_owner(audit_api):
    owner = await audit_api.member("owner")
    other = await audit_api.member("other")
    guest = await audit_api.client()
    car = await audit_api.car(owner, is_public=False)
    path = f"/api/v1/cars/{car['id']}"
    assert (await owner.get(path)).status_code == 200
    assert (await other.get(path)).status_code == 404
    assert (await guest.get(path)).status_code == 404
    assert (await guest.get("/api/v1/cars")).json()["total"] == 0
    assert (await guest.get("/api/v1/users/owner/cars")).json() == []
    assert (await other.patch(path, json={"model": "Stolen"})).status_code == 403
    assert (await other.delete(path)).status_code == 403


async def test_hiding_car_hides_posts_comments_and_favorites(audit_api):
    owner = await audit_api.member("owner")
    other = await audit_api.member("other")
    guest = await audit_api.client()
    car = await audit_api.car(owner)
    post = await owner.post("/api/v1/posts", json={"car_id": car["id"], "content": "Private after hiding"})
    assert post.status_code == 201
    post_id = post.json()["id"]
    await other.put(f"/api/v1/cars/{car['id']}/favorite")
    await other.post(f"/api/v1/posts/{post_id}/comments", json={"content": "Comment"})
    await owner.patch(f"/api/v1/cars/{car['id']}", json={"is_public": False})
    assert (await guest.get("/api/v1/posts")).json()["total"] == 0
    assert (await guest.get(f"/api/v1/posts/{post_id}")).status_code == 404
    assert (await guest.get(f"/api/v1/posts/{post_id}/comments")).status_code == 404
    assert (await other.put(f"/api/v1/posts/{post_id}/like")).status_code == 404
    assert (await other.post(f"/api/v1/posts/{post_id}/comments", json={"content": "Hidden"})).status_code == 404
    assert (await other.get("/api/v1/me/favorites")).json() == []
    assert (await guest.get("/api/v1/users/owner")).json()["posts_count"] == 0
    assert (await owner.post("/api/v1/posts", json={"car_id": car["id"], "content": "Hidden"})).status_code == 422


async def test_social_state_is_returned_after_reload(audit_api):
    owner = await audit_api.member("owner")
    other = await audit_api.member("other")
    car = await audit_api.car(owner)
    path = f"/api/v1/cars/{car['id']}"
    assert (await other.put(f"{path}/favorite")).status_code == 204
    assert (await other.put(f"{path}/rating", json={"score": 8})).status_code == 200
    state = (await other.get(path)).json()
    assert state["is_favorite"] is True
    assert state["my_rating"] == 8
    assert (await owner.get(path)).json()["is_favorite"] is False
    post = (await owner.post("/api/v1/posts", json={"car_id": car["id"], "content": "Story"})).json()
    assert (await other.put(f"/api/v1/posts/{post['id']}/like")).status_code == 204
    assert (await other.get("/api/v1/posts")).json()["items"][0]["is_liked"] is True
    assert (await other.get(f"/api/v1/posts/{post['id']}")).json()["is_liked"] is True


async def test_inactive_accounts_cannot_login_or_refresh(audit_api):
    member = await audit_api.member("owner")
    async with audit_api.sessions() as session:
        user = await session.scalar(select(User).where(User.username == "owner"))
        user.is_active = False
        await session.commit()
    assert (await member.get("/api/v1/auth/me")).status_code == 401
    assert (await member.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "AuditPass123!"})).status_code == 401
    assert (await member.post("/api/v1/auth/refresh")).status_code == 401


@pytest.mark.parametrize("field", ["brand", "model", "year", "mileage", "cover_image_url", "image_urls", "is_public"])
async def test_car_patch_rejects_null_required_values(audit_api, field):
    owner = await audit_api.member("owner")
    car = await audit_api.car(owner)
    response = await owner.patch(f"/api/v1/cars/{car['id']}", json={field: None})
    assert response.status_code == 422, response.text


async def test_missing_post_comments_return_not_found(audit_api):
    guest = await audit_api.client()
    assert (await guest.get(f"/api/v1/posts/{uuid.uuid4()}/comments")).status_code == 404
