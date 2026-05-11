"""API helpers — decorators & utilities for safe error handling."""

from __future__ import annotations

import functools
import ipaddress
import logging
from typing import Any, Callable
from urllib.parse import urlparse


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


def validate_external_url(url: str) -> None:
    """Raise ValueError if URL points to internal/private addresses (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme: {parsed.scheme}")
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: no hostname")
    if hostname.lower() in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("URL points to localhost")
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            raise ValueError(f"URL points to private/reserved IP: {hostname}")
    except ValueError:
        # hostname is not an IP — that's fine
        pass
