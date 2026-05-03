"""Structured logging with redaction."""

from __future__ import annotations

import logging
import sys
from typing import Any

SENSITIVE_KEYS = {"token", "password", "secret", "api_key", "authorization", "cookie"}


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, dict):
            record.msg = self._redact(record.msg)
        if isinstance(record.args, dict):
            record.args = self._redact(record.args)
        return True

    def _redact(self, data: Any) -> Any:
        if isinstance(data, dict):
            return {
                k: "***" if k.lower() in SENSITIVE_KEYS else self._redact(v)
                for k, v in data.items()
            }
        if isinstance(data, list):
            return [self._redact(i) for i in data]
        return data


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        fmt = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        )
        handler.setFormatter(fmt)
        logger.addHandler(handler)
        logger.addFilter(RedactingFilter())
    logger.setLevel(logging.INFO)
    return logger
