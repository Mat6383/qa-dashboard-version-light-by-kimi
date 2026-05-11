"""GitLab issue → Testmo automation test result mapper."""

from __future__ import annotations

import re
from typing import Any

import markdown  # type: ignore[import-untyped]

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
    return any(lbl.lower() == label.lower() for lbl in labels)


def map_issue_to_testmo_status(issue: dict[str, Any]) -> str:
    """Map a GitLab issue to a Testmo automation test status."""
    state = issue.get("state", "")

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


# ------------------------------------------------------------------
# Step extraction from GitLab notes (Routine B)
# ------------------------------------------------------------------

SECTION_HEADER_RE = re.compile(r"\[([^\]]+)\](?!\()")
TEST_RE = re.compile(r"^tests?$", re.IGNORECASE)
TESTMO_EXPECTED = "<p>Conforme aux specs fonctionnelles</p>"


def _parse_sections(body: str) -> list[dict[str, str]]:
    """Extract labeled sections from a GitLab note body.

    Returns [{label, content}, ...] in appearance order.
    Empty-content sections are discarded.
    """
    headers: list[dict[str, Any]] = []
    for m in SECTION_HEADER_RE.finditer(body):
        headers.append({"label": m.group(1).strip(), "start": m.start(), "end": m.end()})

    sections: list[dict[str, str]] = []
    for i, h in enumerate(headers):
        content_end = headers[i + 1]["start"] if i + 1 < len(headers) else len(body)
        content = body[h["end"] : content_end].strip()
        if content:
            sections.append({"label": h["label"], "content": content})
    return sections


def extract_steps_from_notes(notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert GitLab issue notes into Testmo custom_steps.

    Algorithm (ported from backend/services/sync.service.ts):
    1. Keep only notes containing at least one [LABEL] pattern (excluding markdown links).
    2. Non-TEST sections ([PRÉREQUIS], [CONTEXTE], [IMPACT]...) are taken from the
       *longest* note, in their original appearance order.
    3. TEST sections ([TEST] / [TESTS], case-insensitive) are collected from *all*
       notes in chronological order (notes array is assumed sorted asc by created_at).
    4. Final order: non-TEST sections first, then all TEST sections.
    5. Each section is rendered as HTML via markdown.markdown().

    Returns [] if no structured sections are found.
    """
    # Filter notes that contain at least one [LABEL] (not a markdown link)
    structured = [n for n in notes if n.get("body") and SECTION_HEADER_RE.search(n["body"])]
    if not structured:
        return []

    # Non-TEST sections: from the longest note (most complete)
    best = max(structured, key=lambda n: len(n.get("body", "")))
    other_sections = [s for s in _parse_sections(best.get("body", "")) if not TEST_RE.match(s["label"])]

    # TEST sections: collect from ALL notes in chronological order
    all_test_sections: list[dict[str, str]] = []
    for note in structured:
        for s in _parse_sections(note.get("body", "")):
            if TEST_RE.match(s["label"]):
                all_test_sections.append(s)

    if not other_sections and not all_test_sections:
        return []

    steps: list[dict[str, Any]] = []
    for i, s in enumerate(other_sections + all_test_sections, start=1):
        md_source = f"**[{s['label']}]**\n\n{s['content']}"
        steps.append({
            "text1": markdown.markdown(md_source),
            "text3": TESTMO_EXPECTED,
            "display_order": i,
        })

    return steps
