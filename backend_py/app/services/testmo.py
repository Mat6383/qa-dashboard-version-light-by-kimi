"""TestmoService façade — re-exports TestmoClient + TestmoMetrics transparently."""

from __future__ import annotations

from typing import Any

from app.services.testmo_client import TestmoClient
from app.services.testmo_metrics import TestmoMetrics

__all__ = ["TestmoService", "testmo_service"]


class TestmoService(TestmoClient):
    """Backward-compatible façade.

    All HTTP/client methods are inherited from :class:`TestmoClient`.
    Metrics/business methods are forwarded to :class:`TestmoMetrics` via
    ``__getattr__`` so existing callers do not need to change.
    """

    def __init__(self) -> None:
        super().__init__()
        self._metrics = TestmoMetrics(self)

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(f"'{type(self).__name__}' has no attribute '{name}'")
        if hasattr(self._metrics, name):
            return getattr(self._metrics, name)
        raise AttributeError(f"'{type(self).__name__}' has no attribute '{name}'")

    def __dir__(self) -> list[str]:
        base = set(super().__dir__())
        base.update(dir(self._metrics))
        return sorted(base)


testmo_service = TestmoService()
