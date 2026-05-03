"""Collect data for closure report."""

from __future__ import annotations

from typing import Any

from app.services.testmo import testmo_service


async def collect_report_data(run_id: int | None) -> dict[str, Any]:
    if not run_id:
        return {"error": "run_id required"}
    run = await testmo_service.get_run_details(run_id)
    results = await testmo_service.get_run_results(run_id)
    return {
        "run": run,
        "results": results,
        "summary": {
            "total": len(results),
            "passed": sum(1 for r in results if r.get("status") == "passed"),
            "failed": sum(1 for r in results if r.get("status") == "failed"),
        },
    }
