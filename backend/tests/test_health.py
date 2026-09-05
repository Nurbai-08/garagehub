from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_openapi_exposes_garage_crud() -> None:
    schema = TestClient(app).get("/openapi.json").json()
    assert "/api/v1/me/cars" in schema["paths"]
    assert "get" in schema["paths"]["/api/v1/cars/brands"]
    assert {"get", "patch", "delete"}.issubset(schema["paths"]["/api/v1/cars/{car_id}"])
    assert {"get", "post"}.issubset(schema["paths"]["/api/v1/posts"])
    assert {"get", "post"}.issubset(schema["paths"]["/api/v1/cars/{car_id}/service-records"])
    assert "put" in schema["paths"]["/api/v1/cars/{car_id}/rating"]
    assert "post" in schema["paths"]["/api/v1/cars/{car_id}/conversation"]
    assert {"get", "post"}.issubset(schema["paths"]["/api/v1/conversations/{conversation_id}/messages"])
    assert {"get", "post"}.issubset(schema["paths"]["/api/v1/community/messages"])


def test_public_car_schema_never_contains_vin() -> None:
    schema = TestClient(app).get("/openapi.json").json()
    assert "vin" not in schema["components"]["schemas"]["CarOutput"]["properties"]
