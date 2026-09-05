import asyncio
import time
from collections import deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.types import ASGIApp


@dataclass(frozen=True)
class RateLimit:
    requests: int
    window_seconds: int


class SecurityMiddleware(BaseHTTPMiddleware):
    """Adds browser protections and small per-process abuse limits."""

    limits = {
        ("POST", "/api/v1/auth/login"): RateLimit(5, 300),
        ("POST", "/api/v1/auth/register"): RateLimit(3, 3600),
        ("POST", "/api/v1/uploads/images"): RateLimit(20, 60),
        ("POST", "/api/v1/community/messages"): RateLimit(30, 60),
    }

    def __init__(self, app: ASGIApp, is_production: bool) -> None:
        super().__init__(app)
        self.is_production = is_production
        self.requests: dict[tuple[str, str], deque[float]] = {}
        self.lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        limit = self.limits.get((request.method, request.url.path))
        if limit:
            retry_after = await self.retry_after(request, limit)
            if retry_after:
                response: Response = JSONResponse(
                    status_code=429,
                    content={"detail": "Слишком много запросов. Повторите позже."},
                    headers={"Retry-After": str(retry_after)},
                )
                self.add_security_headers(response, request.url.path)
                return response

        response = await call_next(request)
        self.add_security_headers(response, request.url.path)
        return response

    async def retry_after(self, request: Request, limit: RateLimit) -> int:
        client = request.client.host if request.client else "unknown"
        key = (f"{request.method}:{request.url.path}", client)
        now = time.monotonic()

        async with self.lock:
            events = self.requests.setdefault(key, deque())
            threshold = now - limit.window_seconds
            while events and events[0] <= threshold:
                events.popleft()
            if len(events) >= limit.requests:
                return max(1, int(limit.window_seconds - (now - events[0])))
            events.append(now)
        return 0

    def add_security_headers(self, response: Response, path: str) -> None:
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if path.startswith("/api/v1/auth/"):
            response.headers.setdefault("Cache-Control", "no-store")
        if self.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
