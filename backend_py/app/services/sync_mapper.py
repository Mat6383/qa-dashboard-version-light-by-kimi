"""GitLab issue → Testmo automation test result mapper."""

from __future__ import annotations

from typing import Any

from app.config import settings

# Testmo automation status strings (lowercase)
# Reference: https://docs.testmo.com/api/reference#automation-runs
STATUS_UNTESTED = "untested"
STATUS_PASSED = "passed"
STATUS_FAILED = "failed"
STATUS_RETEST = "retest"
STATUS_BLOCKED = "blocked"
STATUS_SKIPPED = "skipped"
STATUS_WIP = "wip"

# Mapping from GitLab issue state + labels → Testmo status
# Priority: Bug > Test::TODO > closed > other
STATUS_PRIORITY = ["Bug", "Test::TODO"]


def _has_label(issue: dict[str, Any], label: str) -> bool:
    labels = issue.get("labels", []) or []
    return any(l.lower() == label.lower() for l in labels)


def map_issue_to_testmo_status(issue: dict[str, Any]) -> str:
    """Map a GitLab issue to a Testmo automation test status."""
    state = issue.get("state", "")
    labels = issue.get("labels", []) or []

    if state == "closed":
        return STATUS_PASSED

    if _has_label(issue, "Bug"):
        return STATUS_FAILED

    if _has_label(issue, "Test::TODO"):
        return STATUS_UNTESTED

    if _has_label(issue, "blocked"):
        return STATUS_BLOCKED

    if _has_label(issue, "WIP") or _has_label(issue, "doing"):
        return STATUS_WIP

    # Default for opened issues without specific labels
    return STATUS_RETEST


def build_testmo_test(
    issue: dict[str, Any],
    project_id: str | int,
    folder: str | None = None,
) -> dict[str, Any]:
    """Build a Testmo automation test object from a GitLab issue."""
    iid = issue.get("iid")
    title = issue.get("title", "")
    description = issue.get("description") or ""
    web_url = issue.get("web_url", "")
    labels = issue.get("labels", []) or []
    time_estimate = issue.get("time_estimate")

    # Unique key for deduplication within the run
    key = f"gitlab-{project_id}-{iid}"

    # Truncate description to avoid huge payloads
    max_desc = 2000
    truncated_desc = description[:max_desc] + "…" if len(description) > max_desc else description

    fields: list[dict[str, Any]] = [
        {"name": "Issue URL", "type": 4, "value": f'<a href="{web_url}">#{iid}</a>'},
        {"name": "Labels", "type": 4, "value": ", ".join(labels) or "—"},
    ]
    if truncated_desc:
        fields.append({"name": "Description", "type": 4, "value": truncated_desc})
    if time_estimate:
        fields.append({"name": "Time Estimate", "type": 4, "value": str(time_estimate)})

    test: dict[str, Any] = {
        "key": key,
        "name": f"[#{iid}] {title}",
        "status": map_issue_to_testmo_status(issue),
        "fields": fields,
    }

    if folder:
        test["folder"] = folder

    return test


def build_run_name(iteration_name: str, version: str | None = None) -> str:
    """Build a deterministic run name from iteration + optional version."""
    base = f"GitLab Sync — {iteration_name}"
    if version:
        base = f"{base} (v{version})"
    return base


def build_run_url(run_id: int) -> str:
    """Build a direct URL to the automation run in Testmo."""
    base = settings.testmo_url.rstrip("/")
    return f"{base}/automation/runs/{run_id}"
