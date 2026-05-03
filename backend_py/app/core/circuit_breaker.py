"""Port of the TypeScript CircuitBreaker — exact behaviour."""

from __future__ import annotations

import asyncio
import time
from enum import Enum
from typing import Any, Callable


class State(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpen(Exception):
    def __init__(self, name: str, retry_after: float = 0.0) -> None:
        self.name = name
        self.retry_after = retry_after
        super().__init__(f"CircuitBreaker [{name}] is OPEN — retry after {retry_after:.1f}s")


class CircuitBreaker:
    """Async circuit breaker with CLOSED → OPEN → HALF_OPEN state machine."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 3,
        expected_exception: type[Exception] = Exception,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.expected_exception = expected_exception

        self._state = State.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: float | None = None
        self._lock = asyncio.Lock()

    @property
    def state(self) -> State:
        if self._state == State.OPEN:
            if self._last_failure_time and (time.monotonic() - self._last_failure_time) > self.recovery_timeout:
                self._state = State.HALF_OPEN
                self._success_count = 0
        return self._state

    async def call(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        async with self._lock:
            current = self.state
            if current == State.OPEN:
                remaining = (self._last_failure_time or 0) + self.recovery_timeout - time.monotonic()
                raise CircuitBreakerOpen(self.name, max(0.0, remaining))

        try:
            result = await fn(*args, **kwargs)
        except self.expected_exception:
            async with self._lock:
                self._failure_count += 1
                self._last_failure_time = time.monotonic()
                if self._state == State.HALF_OPEN:
                    self._state = State.OPEN
                elif self._failure_count >= self.failure_threshold:
                    self._state = State.OPEN
            raise
        else:
            async with self._lock:
                if self._state == State.HALF_OPEN:
                    self._success_count += 1
                    if self._success_count >= self.half_open_max_calls:
                        self._state = State.CLOSED
                        self._success_count = 0
                if self._state == State.CLOSED:
                    self._failure_count = 0
            return result

    async def __aenter__(self) -> CircuitBreaker:
        async with self._lock:
            current = self.state
            if current == State.OPEN:
                remaining = (self._last_failure_time or 0) + self.recovery_timeout - time.monotonic()
                raise CircuitBreakerOpen(self.name, max(0.0, remaining))
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if exc_type is None:
            async with self._lock:
                if self._state == State.HALF_OPEN:
                    self._success_count += 1
                    if self._success_count >= self.half_open_max_calls:
                        self._state = State.CLOSED
                        self._success_count = 0
                if self._state == State.CLOSED:
                    self._failure_count = 0
        elif issubclass(exc_type, self.expected_exception):
            async with self._lock:
                self._failure_count += 1
                self._last_failure_time = time.monotonic()
                if self._state == State.HALF_OPEN:
                    self._state = State.OPEN
                elif self._failure_count >= self.failure_threshold:
                    self._state = State.OPEN

    def clear(self) -> None:
        self._state = State.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = None
