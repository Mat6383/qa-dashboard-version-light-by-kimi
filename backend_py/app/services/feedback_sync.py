"""Scan Testmo runs for filled feedback templates and create GitLab tickets."""

from __future__ import annotations

import html
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feedback_sync import FeedbackSyncRun
from app.services.gitlab import gitlab_service
from app.services.testmo import testmo_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

_PLACEHOLDER_TEXT = "_ _ _"
_PLACEHOLDER_HINT = "Pensez à ajouter un screenshot"
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(value: str) -> str:
    text = _HTML_TAG_RE.sub("", value)
    return html.unescape(text).strip()


def _is_placeholder_text(text: str) -> bool:
    """Return True if the cleaned text is just a placeholder."""
    stripped = text.strip()
    if not stripped:
        return True
    if stripped == _PLACEHOLDER_TEXT:
        return True
    if stripped == "ID : _ _ _":
        return True
    if _PLACEHOLDER_HINT in stripped:
        return True
    return False


def _is_template_filled(note_html: str) -> bool:
    """Return True if at least one section contains non-placeholder text."""
    if not note_html:
        return False

    # Split by h3 headers; pattern gives us (title, content) pairs
    parts = re.split(r"<h3>([^<]+)</h3>", note_html, flags=re.IGNORECASE)
    # parts[0] = preamble (ignored), then title, content, title, content...
    for i in range(1, len(parts), 2):
        section_html = parts[i + 1] if i + 1 < len(parts) else ""
        text = _strip_html(section_html)
        if _is_placeholder_text(text):
            continue
        return True
    return False


class FeedbackSyncService:
    async def scan_project(
        self,
        testmo_project_id: int,
        gitlab_project_id: int | str,
        active_only: bool = True,
        run_ids: list[int] | None = None,
        triggered_by: str = "manual",
        db: AsyncSession | None = None,
    ) -> dict[str, Any]:
        """Scan a single project's Testmo runs and create GitLab tickets for filled feedback notes."""
        stats = {
            "runs_scanned": 0,
            "results_checked": 0,
            "tickets_created": 0,
            "tickets_skipped": 0,
            "errors": 0,
        }
        details: list[dict[str, Any]] = []

        logger.info(
            "[FeedbackSync] Starting scan for testmo_project=%s gitlab_project=%s active_only=%s",
            testmo_project_id,
            gitlab_project_id,
            active_only,
        )

        try:
            all_runs = await testmo_service.get_project_runs(testmo_project_id, active_only)
        except Exception as exc:
            logger.error("[FeedbackSync] Failed to fetch runs: %s", exc)
            raise

        if run_ids:
            runs = [r for r in all_runs if r.get("id") in run_ids]
        else:
            runs = all_runs

        stats["runs_scanned"] = len(runs)
        logger.info(
            "[FeedbackSync] %s run(s) to scan (selected from %s total)",
            len(runs),
            len(all_runs),
        )

        for run in runs:
            run_id = run.get("id")
            run_name = run.get("name", f"Run #{run_id}")
            logger.debug("[FeedbackSync] Scanning run %s — %s", run_id, run_name)

            try:
                results = await testmo_service.get_run_results_paginated(run_id)
            except Exception as exc:
                logger.error("[FeedbackSync] Error fetching results for run %s: %s", run_id, exc)
                stats["errors"] += 1
                continue

            if getattr(results, "truncated", False):
                logger.warning("[FeedbackSync] Run %s results truncated", run_id)

            if not results:
                continue

            # Resolve case names
            needed_ids = list({r.get("case_id") for r in results if r.get("case_id")})
            case_names: dict[int, str] = {}
            if needed_ids:
                try:
                    case_names = await testmo_service.get_case_names(testmo_project_id, needed_ids)
                except Exception as exc:
                    logger.warning("[FeedbackSync] Failed to resolve case names: %s", exc)

            for result in results:
                stats["results_checked"] += 1
                fields = result.get("fields") or []
                note_field = next((f for f in fields if f.get("name") == "Note"), None)
                if not note_field:
                    continue

                note_html = note_field.get("value") or ""
                if not _is_template_filled(note_html):
                    continue

                case_name = result.get("case_name") or case_names.get(result.get("case_id"))
                if not case_name:
                    logger.debug("[FeedbackSync] Skipping result with unknown case name")
                    continue

                issue_title = f"{case_name} - Retour"

                # Deduplication: search by exact title + TESTMO label
                try:
                    existing = await gitlab_service.search_issue_by_title(
                        gitlab_project_id, issue_title
                    )
                    if existing and "TESTMO" in (existing.get("labels") or []):
                        stats["tickets_skipped"] += 1
                        details.append(
                            {
                                "run_id": run_id,
                                "run_name": run_name,
                                "case_name": case_name,
                                "action": "skipped",
                                "reason": "ticket_already_exists",
                                "issue_iid": existing.get("iid"),
                            }
                        )
                        logger.info(
                            '[FeedbackSync] Skipped "%s" — ticket #%s already exists',
                            issue_title,
                            existing.get("iid"),
                        )
                        continue
                except Exception as exc:
                    logger.warning("[FeedbackSync] Deduplication search failed: %s", exc)

                # Resolve milestone
                milestone_id: int | None = None
                try:
                    milestone = await gitlab_service.get_milestone_by_title(
                        gitlab_project_id, "Version du Turfu"
                    )
                    if milestone:
                        milestone_id = milestone.get("id")
                    else:
                        logger.warning(
                            '[FeedbackSync] Milestone "Version du Turfu" not found in project %s',
                            gitlab_project_id,
                        )
                except Exception as exc:
                    logger.warning("[FeedbackSync] Milestone lookup failed: %s", exc)

                # Create GitLab issue
                try:
                    issue = await gitlab_service.create_issue(
                        project_id=gitlab_project_id,
                        title=issue_title,
                        description=note_html,
                        labels=["TESTMO"],
                        milestone_id=milestone_id,
                    )
                    stats["tickets_created"] += 1
                    details.append(
                        {
                            "run_id": run_id,
                            "run_name": run_name,
                            "case_name": case_name,
                            "action": "created",
                            "issue_iid": issue.get("iid"),
                            "issue_url": issue.get("web_url"),
                        }
                    )
                    logger.info(
                        '[FeedbackSync] Created ticket #%s "%s"',
                        issue.get("iid"),
                        issue_title,
                    )
                except Exception as exc:
                    stats["errors"] += 1
                    details.append(
                        {
                            "run_id": run_id,
                            "run_name": run_name,
                            "case_name": case_name,
                            "action": "error",
                            "reason": str(exc),
                        }
                    )
                    logger.error(
                        '[FeedbackSync] Failed to create ticket "%s": %s',
                        issue_title,
                        exc,
                    )

        summary = {
            "triggered_by": triggered_by,
            "project_id": int(gitlab_project_id)
            if isinstance(gitlab_project_id, str) and gitlab_project_id.isdigit()
            else gitlab_project_id,
            **stats,
            "details": details,
        }

        # Persist history if DB session provided
        if db is not None:
            try:
                run_record = FeedbackSyncRun(
                    triggered_by=triggered_by,
                    project_id=summary["project_id"],
                    runs_scanned=stats["runs_scanned"],
                    results_checked=stats["results_checked"],
                    tickets_created=stats["tickets_created"],
                    tickets_skipped=stats["tickets_skipped"],
                    details=details,
                )
                db.add(run_record)
                await db.commit()
                logger.info("[FeedbackSync] History persisted (id=%s)", run_record.id)
            except Exception as exc:
                logger.error("[FeedbackSync] Failed to persist history: %s", exc)
                await db.rollback()

        logger.info(
            "[FeedbackSync] Scan complete — runs=%s checked=%s created=%s skipped=%s errors=%s",
            stats["runs_scanned"],
            stats["results_checked"],
            stats["tickets_created"],
            stats["tickets_skipped"],
            stats["errors"],
        )
        return summary

    async def get_history(self, db: AsyncSession, limit: int = 50) -> list[dict[str, Any]]:
        result = await db.execute(
            select(FeedbackSyncRun).order_by(FeedbackSyncRun.created_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "triggered_by": r.triggered_by,
                "project_id": r.project_id,
                "runs_scanned": r.runs_scanned,
                "results_checked": r.results_checked,
                "tickets_created": r.tickets_created,
                "tickets_skipped": r.tickets_skipped,
                "details": r.details,
            }
            for r in rows
        ]


feedback_sync_service = FeedbackSyncService()
