import pytest

from app.storage import LocalImageStorage

pytestmark = pytest.mark.anyio


async def test_registration_login_refresh_rotation_and_logout(audit_api):
    member = await audit_api.member("owner")
    guest = await audit_api.client()
    assert (await guest.get("/api/v1/auth/me")).status_code == 401
    assert (await member.get("/api/v1/auth/me")).json()["username"] == "owner"
    duplicate = await guest.post("/api/v1/auth/register", json={"email": "OWNER@example.com", "username": "new_name", "password": "AuditPass123!"})
    assert duplicate.status_code == 409
    login = await member.post("/api/v1/auth/login", json={"email": "OWNER@example.com", "password": "AuditPass123!"})
    assert login.status_code == 200
    old_cookie = member.cookies.get("refresh_token")
    rotated = await member.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    assert member.cookies.get("refresh_token") != old_cookie
    replay = await guest.post("/api/v1/auth/refresh", headers={"Cookie": f"refresh_token={old_cookie}"})
    assert replay.status_code == 401
    assert (await member.post("/api/v1/auth/logout")).status_code == 204
    assert (await member.post("/api/v1/auth/refresh")).status_code == 401


async def test_catalog_filters_pagination_and_profile(audit_api):
    owner = await audit_api.member("owner")
    guest = await audit_api.client()
    await audit_api.car(owner, brand="BMW", power_hp=400, drivetrain="RWD")
    await audit_api.car(owner, brand="Audi", model="A4", year=2015, power_hp=200, drivetrain="AWD")
    await audit_api.car(owner, brand="Hidden", is_public=False)
    catalog = (await guest.get("/api/v1/cars", params={"page_size": 1})).json()
    assert catalog["total"] == 2 and catalog["total_pages"] == 2 and len(catalog["items"]) == 1
    second = (await guest.get("/api/v1/cars", params={"page_size": 1, "page": 2})).json()
    assert second["items"][0]["id"] != catalog["items"][0]["id"]
    filtered = (await guest.get("/api/v1/cars", params={"brand": "bmw", "year_from": 2020, "power_from": 300, "drivetrain": "RWD"})).json()
    assert filtered["total"] == 1 and filtered["items"][0]["brand"] == "BMW"
    assert (await guest.get("/api/v1/cars", params={"search": "A4"})).json()["total"] == 1
    assert (await guest.get("/api/v1/cars/brands")).json() == ["Audi", "BMW"]
    assert (await guest.get("/api/v1/cars", params={"page": 0})).status_code == 422
    assert (await owner.patch("/api/v1/users/me", json={"display_name": "Test Owner", "city": "Bishkek", "bio": "Cars"})).status_code == 200
    profile = (await guest.get("/api/v1/users/OWNER")).json()
    assert profile["cars_count"] == 2 and profile["display_name"] == "Test Owner"
    assert "email" not in profile


async def test_social_crud_and_car_delete_cascades(audit_api):
    owner = await audit_api.member("owner")
    other = await audit_api.member("other")
    car = await audit_api.car(owner)
    path = f"/api/v1/cars/{car['id']}"
    assert (await owner.put(f"{path}/rating", json={"score": 8})).status_code == 403
    assert (await other.put(f"{path}/rating", json={"score": 11})).status_code == 422
    await other.put(f"{path}/rating", json={"score": 8})
    rating = (await other.put(f"{path}/rating", json={"score": 6})).json()
    assert rating == {"rating_avg": 6, "rating_count": 1}
    await other.put(f"{path}/favorite")
    await other.put(f"{path}/favorite")
    assert (await owner.get(path)).json()["favorites_count"] == 1
    await other.delete(f"{path}/favorite")
    await other.delete(f"{path}/favorite")
    assert (await owner.get(path)).json()["favorites_count"] == 0
    post = (await owner.post("/api/v1/posts", json={"car_id": car["id"], "content": " Story "})).json()
    assert post["content"] == "Story"
    post_path = f"/api/v1/posts/{post['id']}"
    assert (await other.post("/api/v1/posts", json={"car_id": car["id"], "content": "Stolen"})).status_code == 403
    await other.put(f"{post_path}/like")
    await other.put(f"{post_path}/like")
    assert (await other.get(post_path)).json()["likes_count"] == 1
    await other.delete(f"{post_path}/like")
    assert (await other.get(post_path)).json()["likes_count"] == 0
    comment = (await other.post(f"{post_path}/comments", json={"content": " Comment "})).json()
    assert (await owner.get(post_path)).json()["comments_count"] == 1
    assert (await owner.delete(f"/api/v1/comments/{comment['id']}")).status_code == 403
    assert (await other.delete(f"/api/v1/comments/{comment['id']}")).status_code == 204
    assert (await other.delete(post_path)).status_code == 403
    assert (await owner.delete(path)).status_code == 204
    assert (await other.get(post_path)).status_code == 404
    assert (await other.get(path)).status_code == 404


async def test_messages_are_private_and_read_receipts_work(audit_api):
    owner = await audit_api.member("owner")
    other = await audit_api.member("other")
    stranger = await audit_api.member("stranger")
    car = await audit_api.car(owner)
    start_path = f"/api/v1/cars/{car['id']}/conversation"
    assert (await owner.post(start_path)).status_code == 400
    conversation = (await other.post(start_path)).json()
    assert (await other.post(start_path)).json()["id"] == conversation["id"]
    path = f"/api/v1/conversations/{conversation['id']}"
    assert (await stranger.get(path)).status_code == 404
    assert (await stranger.get(f"{path}/messages")).status_code == 404
    assert (await stranger.post(f"{path}/messages", json={"content": "No access"})).status_code == 404
    assert (await other.post(f"{path}/messages", json={"content": "   "})).status_code == 422
    sent = await other.post(f"{path}/messages", json={"content": " Hello "})
    assert sent.status_code == 201 and sent.json()["content"] == "Hello"
    assert (await owner.get("/api/v1/conversations")).json()[0]["unread_count"] == 1
    messages = (await owner.get(f"{path}/messages")).json()
    assert messages[0]["read_at"] is not None
    assert (await owner.get(path)).json()["unread_count"] == 0


async def test_community_messages_require_authentication(audit_api):
    owner = await audit_api.member("owner")
    guest = await audit_api.client()
    assert (await guest.get("/api/v1/community/messages")).status_code == 401
    assert (await owner.post("/api/v1/community/messages", json={"content": " "})).status_code == 422
    assert (await owner.post("/api/v1/community/messages", json={"content": "Hello garage"})).status_code == 201
    assert (await owner.get("/api/v1/community/messages")).json()[0]["content"] == "Hello garage"


async def test_service_records_permissions_and_currency_totals(audit_api):
    owner = await audit_api.member("owner")
    other = await audit_api.member("other")
    car = await audit_api.car(owner)
    path = f"/api/v1/cars/{car['id']}/service-records"
    record = {"category": "maintenance", "title": "Oil", "service_date": "2026-09-01", "cost": "1200.50", "currency": "KGS"}
    created = await owner.post(path, json=record)
    assert created.status_code == 201
    record_id = created.json()["id"]
    assert (await other.get(path)).status_code == 403
    assert (await other.post(path, json=record)).status_code == 403
    assert (await other.patch(f"/api/v1/service-records/{record_id}", json={"title": "Wrong"})).status_code == 403
    assert (await other.delete(f"/api/v1/service-records/{record_id}")).status_code == 403
    assert (await owner.patch(f"/api/v1/service-records/{record_id}", json={"cost": None})).status_code == 422
    await owner.post(path, json={**record, "currency": "USD", "cost": "10.00"})
    stats_path = f"/api/v1/cars/{car['id']}/service-stats"
    stats = (await owner.get(stats_path)).json()
    assert float(stats["total"]) == 1200.5 and stats["currency"] == "KGS"
    usd = (await owner.get(stats_path, params={"currency": "USD"})).json()
    assert float(usd["total"]) == 10 and usd["currency"] == "USD"
    assert (await owner.delete(f"/api/v1/service-records/{record_id}")).status_code == 204


async def test_upload_rejects_empty_corrupt_and_oversized_images(audit_api, tmp_path, monkeypatch, png_bytes):
    owner = await audit_api.member("owner")
    guest = await audit_api.client()
    monkeypatch.setattr("app.main.image_storage", LocalImageStorage(str(tmp_path / "uploads")))
    path = "/api/v1/uploads/images"
    assert (await guest.post(path, files={"file": ("ok.png", png_bytes, "image/png")})).status_code == 401
    assert (await owner.post(path, files={"file": ("ok.png", png_bytes, "image/png")})).status_code == 200
    for filename, content, mime, code in [
        ("empty.png", b"", "image/png", 422),
        ("fake.png", b"not an image", "image/png", 422),
        ("corrupt.png", b"\x89PNG\r\n\x1a\n" + b"0" * 32, "image/png", 422),
        ("large.png", b"0" * (4 * 1024 * 1024 + 1), "image/png", 413),
        ("vector.svg", b"<svg />", "image/svg+xml", 422),
    ]:
        response = await owner.post(path, files={"file": (filename, content, mime)})
        assert response.status_code == code, response.text
