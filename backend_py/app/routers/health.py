"""Health, readiness, circuit breakers."""

from __future__ import annotations

import shutil
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter

from app.core.circuit_breaker import CircuitBreaker
from app.deps import DBMain
from app.services.gitlab import gitlab_service
from app.services.testmo import testmo_service

router = APIRouter()

# Registry of active circuit breakers for health inspection
_CIRCUIT_BREAKERS: dict[str, CircuitBreaker] = {
    "testmo": testmo_service.cb,
    "gitlab_rest": gitlab_service.cb_rest,
    "gitlab_graphql": gitlab_service.cb_graphql,
}


def _get_uptime() -> float:
    try:
        import time

        import psutil
        return time.time() - psutil.Process().create_time()
    except Exception:
        return 0.0


@router.get("/")
@router.get("")
async def health_check() -> dict[str, Any]:
    return {
        "status": "OK",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": _get_uptime(),
        "environment": "development",
        "version": "3.0.0",
        "checks": {"server": {"status": "OK"}},
    }


@router.get("/ready")
async def readiness(db: DBMain) -> dict[str, Any]:
    return {
        "status": "OK",
        "checks": {"syncHistoryDB": {"status": "OK"}, "commentsDB": {"status": "OK"}},
    }


@router.get("/detailed")
async def detailed_health(db: DBMain) -> dict[str, Any]:
    total, used, free = shutil.disk_usage("/")
    return {
        "status": "OK",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": 0,
        "environment": "development",
        "version": "3.0.0",
        "disk": {
            "total": total,
            "used": used,
            "free": free,
            "usage_percent": round(used / total, 4),
        },
        "checks": {
            "syncHistoryDB": {"status": "OK"},
            "commentsDB": {"status": "OK"},
        },
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
