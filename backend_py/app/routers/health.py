"""Health, readiness, circuit breakers."""

from __future__ import annotations

import asyncio
import shutil
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.config import settings
from app.core.circuit_breaker import CircuitBreaker
from app.deps import DBComments, DBMain
from app.services.gitlab import gitlab_service
from app.services.testmo import testmo_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

# Registry of active circuit breakers for health inspection
_CIRCUIT_BREAKERS: dict[str, CircuitBreaker] = {
    "testmo": testmo_service.cb,
    "gitlab_rest": gitlab_service.cb_rest,
    "gitlab_graphql": gitlab_service.cb_graphql,
}

_HEALTH_TIMEOUT = 5.0
_DISK_WARNING_PCT = 0.90


def _get_uptime() -> float:
    try:
        import time

        import psutil

        return time.time() - psutil.Process().create_time()
    except Exception:
        return 0.0


async def _check_db(db: DBMain) -> dict[str, Any]:
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "OK", "response_ms": 0}
    except Exception as exc:
        logger.warning("Health check DB failed: %s", exc)
        return {"status": "DOWN", "error": str(exc)}


async def _check_testmo() -> dict[str, Any]:
    try:
        ok = await asyncio.wait_for(testmo_service.health_check(), timeout=_HEALTH_TIMEOUT)
        return {"status": "OK" if ok else "DOWN"}
    except asyncio.TimeoutError:
        return {"status": "TIMEOUT", "error": f"No response within {_HEALTH_TIMEOUT}s"}
    except Exception as exc:
        return {"status": "DOWN", "error": str(exc)}


async def _check_gitlab() -> dict[str, Any]:
    try:
        ok = await asyncio.wait_for(gitlab_service.health_check(), timeout=_HEALTH_TIMEOUT)
        return {"status": "OK" if ok else "DOWN"}
    except asyncio.TimeoutError:
        return {"status": "TIMEOUT", "error": f"No response within {_HEALTH_TIMEOUT}s"}
    except Exception as exc:
        return {"status": "DOWN", "error": str(exc)}


def _check_disk() -> dict[str, Any]:
    try:
        total, used, free = shutil.disk_usage("/")
        usage_pct = used / total if total else 0.0
        disk_status = "WARNING" if usage_pct > _DISK_WARNING_PCT else "OK"
        return {
            "status": disk_status,
            "total": total,
            "used": used,
            "free": free,
            "usage_percent": round(usage_pct, 4),
        }
    except Exception as exc:
        return {"status": "DOWN", "error": str(exc)}


@router.get("/")
@router.get("")
async def health_check() -> dict[str, Any]:
    return {
        "status": "OK",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": _get_uptime(),
        "environment": settings.environment,
        "version": "3.0.0",
        "checks": {"server": {"status": "OK"}},
    }


@router.get("/ready")
async def readiness(db_main: DBMain, db_comments: DBComments, response: Response) -> dict[str, Any]:
    """Kubernetes-style readiness probe.

    Returns 503 if a critical dependency (database) is unreachable.
    """
    main_db_check = await _check_db(db_main)
    comments_db_check = await _check_db(db_comments)

    checks = {
        "main_db": main_db_check,
        "comments_db": comments_db_check,
    }

    all_ok = all(c["status"] == "OK" for c in checks.values())
    if not all_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "OK" if all_ok else "DOWN",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }


@router.get("/detailed")
async def detailed_health(
    db_main: DBMain,
    db_comments: DBComments,
) -> dict[str, Any]:
    """Full health report for monitoring dashboards.

    External services (Testmo/GitLab) are non-critical: the app stays UP
    without them, but status becomes DEGRADED.
    """
    main_db = await _check_db(db_main)
    comments_db = await _check_db(db_comments)
    testmo = await _check_testmo()
    gitlab = await _check_gitlab()
    disk = _check_disk()

    checks = {
        "main_db": main_db,
        "comments_db": comments_db,
        "testmo": testmo,
        "gitlab": gitlab,
        "disk": disk,
    }

    # Critical = DB. Non-critical = external services + disk.
    critical_ok = main_db["status"] == "OK" and comments_db["status"] == "OK"
    non_critical_ok = all(
        checks[k]["status"] in ("OK", "WARNING") for k in ("testmo", "gitlab", "disk")
    )

    if not critical_ok:
        overall = "DOWN"
    elif not non_critical_ok:
        overall = "DEGRADED"
    else:
        overall = "OK"

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": _get_uptime(),
        "environment": settings.environment,
        "version": "3.0.0",
        "disk": disk,
        "checks": checks,
        "circuit_breakers": [
            {
                "name": name,
                "state": cb.state.value,
                "failure_count": cb._failure_count,
            }
            for name, cb in _CIRCUIT_BREAKERS.items()
        ],
    }


@router.get("/circuit-breakers")
async def circuit_breakers() -> dict[str, Any]:
    return {
        "circuit_breakers": [
            {
                "name": name,
                "state": cb.state.value,
                "failure_count": cb._failure_count,
            }
            for name, cb in _CIRCUIT_BREAKERS.items()
        ]
    }
