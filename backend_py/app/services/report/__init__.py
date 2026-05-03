"""Report service placeholder."""

from __future__ import annotations

from typing import Any


class ReportService:
    async def generate(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"status": "not_implemented", "payload": payload}


report_service = ReportService()
