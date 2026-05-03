"""Composes tenacity retry + circuit breaker — port of withResilience.ts."""

from __future__ import annotations

import functools
from typing import Any, Callable

import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.core.circuit_breaker import CircuitBreaker

RETRYABLE_EXCEPTIONS = (
    httpx.HTTPStatusError,
    httpx.ConnectError,
    httpx.TimeoutException,
    httpx.NetworkError,
    httpx.RemoteProtocolError,
)


def _is_retryable(exc: BaseException) -> bool:
    """Retry on network/timeout errors AND on 429 / 5xx status codes."""
    if isinstance(exc, RETRYABLE_EXCEPTIONS):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return code == 429 or code >= 500
    return False


def with_resilience(
    breaker: CircuitBreaker | None = None,
    max_attempts: int = 3,
    base_delay_ms: float = 500.0,
) -> Callable[..., Any]:
    """Decorator that adds tenacity retry + optional circuit breaker."""
    tenacity_retry = retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=base_delay_ms / 1000, max=30),
        retry=retry_if_exception(_is_retryable),
        reraise=True,
    )

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @tenacity_retry
        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            if breaker is not None:
                return await breaker.call(fn, *args, **kwargs)
            return await fn(*args, **kwargs)

        return wrapper

    return decorator
