"""FastAPI application entrypoint with lifespan."""

from __future__ import annotations

import hmac
from contextlib import asynccontextmanager
from time import time

import sentry_sdk
from fastapi import FastAPI, Request
from brotli_asgi import BrotliMiddleware
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, make_asgi_app
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response

from app.config import settings
from app.database import init_databases
from app.jobs.scheduler import start_scheduler, stop_scheduler
from app.routers import (
    analytics,
    anomalies,
    audit,
    auth,
    backups,
    cache,
    crosstest,
    dashboard,
    docs,
    export,
    feature_flags,
    feedback_sync,
    health,
    integrations,
    metrics,
    notifications,
    pdf,
    projects,
    reports,
    retention,
    runs,
    sync,
    testmo_browser,
    trpc,
    webhooks,
    websocket,
)

if not settings.jwt_secret or len(settings.jwt_secret) < 32:
    raise RuntimeError(
        "JWT_SECRET must be set and at least 32 characters long. "
        f"Current value: {'<empty>' if not settings.jwt_secret else '<too short>'}"
    )

if settings.sentry_dsn and settings.environment == "production":
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=settings.sentry_traces_sample_rate,
    )

# ── Prometheus custom metrics ───────────────────────────
HTTP_DURATION = Histogram(
    "qa_dashboard_http_request_duration_seconds",
    "HTTP request duration",
    ["method", "path", "status"],
)
HTTP_TOTAL = Counter(
    "qa_dashboard_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)
HTTP_ERRORS = Counter(
    "qa_dashboard_http_errors_total",
    "Total HTTP errors (4xx/5xx)",
    ["method", "path", "status"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_databases()
    # Seed test-flag for E2E compatibility (Node.js persistent DB assumption)
    from sqlalchemy import select

    from app.database import get_main_db
    from app.models.feature_flags import FeatureFlag

    async with get_main_db() as db:
        result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == "test-flag"))
        if not result.scalar_one_or_none():
            db.add(FeatureFlag(key="test-flag", enabled=False, description="E2E test flag"))
            await db.commit()
    start_scheduler()
    yield
    stop_scheduler()
    from app.services.gitlab import gitlab_service
    from app.services.pdf import pdf_service
    from app.services.testmo import testmo_service

    await gitlab_service.close()
    await testmo_service.close()
    await pdf_service.shutdown()


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="QA Dashboard API",
    version="3.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Middleware ──────────────────────────────────────────
@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    start = time()
    response = await call_next(request)
    duration = time() - start
    status = str(response.status_code)
    route = request.scope.get("route")
    path = getattr(route, "path", None) or request.url.path
    method = request.method

    HTTP_DURATION.labels(method=method, path=path, status=status).observe(duration)
    HTTP_TOTAL.labels(method=method, path=path, status=status).inc()
    if response.status_code >= 400:
        HTTP_ERRORS.labels(method=method, path=path, status=status).inc()
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-Id", "X-Admin-Token"],
)
app.add_middleware(BrotliMiddleware, minimum_size=1000, quality=4)


class SecurityHeadersMiddleware:
    """ASGI middleware adding security headers to every response."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = message.get("headers", [])
                security_headers = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"strict-origin-when-cross-origin"),
                    (b"permissions-policy", b"geolocation=(), microphone=(), camera=()"),
                    (
                        b"content-security-policy",
                        b"default-src 'self'; script-src 'self' 'unsafe-inline' https://browser.sentry-cdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.sentry.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
                    ),
                ]
                if settings.environment == "production":
                    security_headers.append(
                        (
                            b"strict-transport-security",
                            b"max-age=31536000; includeSubDomains; preload",
                        )
                    )
                headers.extend(security_headers)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


class CacheControlMiddleware:
    """ASGI middleware adding sensible Cache-Control defaults."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_cache(message):
            if message["type"] == "http.response.start":
                headers = message.get("headers", [])
                path = scope.get("path", "")
                method = scope.get("method", "")
                if (
                    method in ("GET", "HEAD")
                    and path.startswith("/api/")
                    and not path.startswith("/api/auth")
                ):
                    # API read endpoints: short private cache with stale-while-revalidate
                    headers.append(
                        (b"cache-control", b"private, max-age=30, stale-while-revalidate=120")
                    )
                else:
                    # Default: no cache for mutations / auth
                    headers.append((b"cache-control", b"private, max-age=0, must-revalidate"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_cache)


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CacheControlMiddleware)


# ── Metrics endpoint (Prometheus) ───────────────────────
class MetricsAuthMiddleware:
    """ASGI middleware protecting /metrics with a secret key."""

    def __init__(self, app, secret: str | None = None):
        self.app = app
        self.secret = secret

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = StarletteRequest(scope, receive)
            provided = request.query_params.get("key") or request.headers.get("x-metrics-key")
            if self.secret:
                if not provided or not hmac.compare_digest(self.secret, provided):
                    response = Response("Forbidden", status_code=403)
                    await response(scope, receive, send)
                    return
        await self.app(scope, receive, send)


metrics_app = make_asgi_app()
app.mount("/metrics", MetricsAuthMiddleware(metrics_app, secret=settings.admin_api_token))

# ── Routers ─────────────────────────────────────────────
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(sync.router, prefix="/api/sync", tags=["sync"])
app.include_router(crosstest.router, prefix="/api/crosstest", tags=["crosstest"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(pdf.router, prefix="/api/pdf", tags=["pdf"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(feature_flags.router, prefix="/api/feature-flags", tags=["feature-flags"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(anomalies.router, prefix="/api/anomalies", tags=["anomalies"])
app.include_router(cache.router, prefix="/api/cache", tags=["cache"])
app.include_router(backups.router, prefix="/api/admin/backups", tags=["backups"])
app.include_router(docs.router, prefix="/api/docs", tags=["docs"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(retention.router, prefix="/api/retention", tags=["retention"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])
app.include_router(trpc.router, prefix="/trpc", tags=["trpc"])
app.include_router(testmo_browser.router, prefix="/api/testmo-browser", tags=["testmo-browser"])
app.include_router(feedback_sync.router, prefix="/api/feedback-sync", tags=["feedback-sync"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])
