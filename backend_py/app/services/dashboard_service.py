"""Dashboard service — DB query logic extracted from routers."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import select

from app.models.sync_history import MetricSnapshot


async def get_metric_snapshots(
    db: Any, project_id: int, from_date: str | None, to_date: str | None
) -> list[dict[str, Any]]:
    """Fetch MetricSnapshot rows for a project with optional date filters."""
    stmt = select(MetricSnapshot).where(MetricSnapshot.project_id == project_id)
    if from_date:
        stmt = stmt.where(MetricSnapshot.date >= from_date)
    if to_date:
        stmt = stmt.where(MetricSnapshot.date <= to_date)
    stmt = stmt.order_by(MetricSnapshot.date).limit(2000)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "date": r.date,
            "pass_rate": r.pass_rate,
            "completion_rate": r.completion_rate,
            "escape_rate": r.escape_rate,
            "detection_rate": r.detection_rate,
            "blocked_rate": r.blocked_rate,
            "total_tests": r.total_tests,
        }
        for r in rows
    ]


def aggregate_snapshots(snapshots: list[dict[str, Any]], granularity: str) -> list[dict[str, Any]]:
    """Aggregate daily snapshots by week or month."""
    if granularity == "day" or not snapshots:
        return snapshots

    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for s in snapshots:
        date = s["date"]
        if granularity == "week":
            d = datetime.strptime(date, "%Y-%m-%d")
            key = d.strftime("%Y-W%W")
        else:
            key = date[:7]
        groups[key].append(s)

    def _avg(field: str, group: list[dict[str, Any]]) -> float | None:
        vals = [g[field] for g in group if g[field] is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    aggregated: list[dict[str, Any]] = []
    for key in sorted(groups.keys()):
        group = groups[key]
        label = key + "-01" if granularity == "month" else group[0]["date"]
        aggregated.append(
            {
                "date": label,
                "pass_rate": _avg("pass_rate", group),
                "completion_rate": _avg("completion_rate", group),
                "escape_rate": _avg("escape_rate", group),
                "detection_rate": _avg("detection_rate", group),
                "blocked_rate": _avg("blocked_rate", group),
                "total_tests": _avg("total_tests", group),
            }
        )
    return aggregated
