"""Generate HTML closure report."""

from __future__ import annotations

from typing import Any


def generate_html_report(data: dict[str, Any]) -> str:
    summary = data.get("summary", {})
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Closure Report</title></head>
<body>
<h1>ISTQB Closure Report</h1>
<p>Total: {summary.get('total', 0)}</p>
<p>Passed: {summary.get('passed', 0)}</p>
<p>Failed: {summary.get('failed', 0)}</p>
</body>
</html>"""
