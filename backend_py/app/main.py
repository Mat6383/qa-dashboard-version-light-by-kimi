"""FastAPI application entrypoint with lifespan."""

from __future__ import annotations

from contextlib import asynccontextmanager
from time import time

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, make_asgi_app
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.database import init_databases
from app.jobs.scheduler import start_scheduler, stop_scheduler
from app.routers import (
    anomalies,
    analytics,
    audit,
    auth,
    backups,
    cache,
    crosstest,
    dashboard,
    docs,
    export,
    feature_flags,
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
    trpc,
    webhooks,
    websocket,
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
    start_scheduler()
    yield
    stop_scheduler()
    from app.services.pdf import pdf_service
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
    path = request.url.path
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
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Metrics endpoint (Prometheus) ───────────────────────
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

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
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])
