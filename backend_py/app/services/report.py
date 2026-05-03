"""Report orchestrator (HTML + PPTX)."""

from __future__ import annotations

from typing import Any

from app.services.report.collect_data import collect_report_data
from app.services.report.generate_html import generate_html_report
from app.services.report.generate_pptx import generate_pptx_report


class ReportService:
    async def generate(self, payload: dict[str, Any]) -> dict[str, Any]:
        run_id = payload.get("run_id")
        data = await collect_report_data(run_id)
        html = generate_html_report(data)
        pptx_bytes = generate_pptx_report(data)
        return {
            "html": html,
            "pptx_base64": pptx_bytes.hex() if pptx_bytes else None,
        }


report_service = ReportService()
