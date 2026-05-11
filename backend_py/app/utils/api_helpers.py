"""API helpers — decorators & utilities for safe error handling."""

from __future__ import annotations

import functools
import logging
from typing import Any, Callable


def sanitize_errors(
    logger: logging.Logger,
    *,
    msg: str = "Unhandled error",
    default_return: dict[str, Any] | None = None,
    reraise: tuple[type[Exception], ...] | None = None,
) -> Callable[[Callable], Callable]:
    """Decorator that catches exceptions, logs them, and returns a safe default.

    Usage::

        @sanitize_errors(logger, msg="Email send failed")
        async def send_email(...) -> dict[str, Any]:
            ...
    """
    safe = default_return if default_return is not None else {"success": False, "error": "Internal server error"}

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return await func(*args, **kwargs)
            except Exception as exc:
                if reraise and isinstance(exc, reraise):
                    raise
                logger.error(msg, exc_info=True)
                return safe

        return async_wrapper

    return decorator
