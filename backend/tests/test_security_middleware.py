import pytest
from fastapi import FastAPI
from starlette.requests import Request

from app.security_middleware import RateLimit, SecurityMiddleware


def make_request(path: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": [],
            "client": ("198.51.100.10", 12345),
            "scheme": "http",
            "server": ("testserver", 80),
        }
    )


@pytest.mark.anyio
async def test_rate_limit_blocks_the_next_request() -> None:
    middleware = SecurityMiddleware(FastAPI(), is_production=False)
    request = make_request("/api/v1/auth/login")
    limit = RateLimit(requests=2, window_seconds=60)

    assert await middleware.retry_after(request, limit) == 0
    assert await middleware.retry_after(request, limit) == 0
    assert await middleware.retry_after(request, limit) > 0
