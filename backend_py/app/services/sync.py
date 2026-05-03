"""GitLab ↔ Testmo sync orchestration."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.models.sync_history import SyncRun
from app.services.gitlab import gitlab_service
from app.services.sync_mapper import (
    build_run_name,
    build_run_url,
    build_testmo_test,
    map_issue_to_testmo_status,
)
from app.services.testmo import testmo_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Batch size for pushing test results to Testmo
TESTMO_BATCH_SIZE = 50


class SyncService:
    async def list_sync_projects(self) -> list[dict[str, Any]]:
        """Return configured sync projects (GitLab)."""
        projects = []
        if settings.gitlab_project_id:
            try:
                proj = await gitlab_service.get_project(settings.gitlab_project_id)
                projects.append({
                    "id": proj.get("id"),
                    "name": proj.get("name"),
                    "path_with_namespace": proj.get("path_with_namespace"),
                })
            except Exception as exc:
                logger.warning("Failed to fetch sync project", extra={"error": str(exc)})
        return projects

    async def list_iterations(self, project_id: str | int, search: str | None = None) -> list[dict[str, Any]]:
        iterations = await gitlab_service.get_project_iterations(project_id, search)
        return [
            {
                "id": it.get("id"),
                "title": it.get("title"),
                "start_date": it.get("start_date"),
                "due_date": it.get("due_date"),
                "state": it.get("state"),
            }
            for it in iterations
        ]

    async def preview_sync(
        self,
        project_id: str | int,
        iteration_name: str,
        run_id: int | None = None,
        version: str | None = None,
        source: str = "gitlab-sync",
        testmo_project_id: int | None = None,
    ) -> dict[str, Any]:
        """Dry-run sync: show what would be synchronized."""
        tmo_project = testmo_project_id or settings.testmo_project_id

        iteration = await gitlab_service.find_iteration(project_id, iteration_name)
        if not iteration:
            return {"error": f"Iteration '{iteration_name}' not found"}

        issues = await gitlab_service.get_issues_by_label_and_iteration(
            project_id, "QA", iteration["id"]
        )

        # Determine target run
        target_run: dict[str, Any] | None = None
        run_action = "none"
        if run_id:
            try:
                target_run = await testmo_service.get_automation_run_details(run_id)
                run_action = "use_existing"
            except Exception:
                run_action = "run_not_found"
        else:
            run_name = build_run_name(iteration_name, version)
            try:
                existing = await testmo_service.find_automation_run(
                    tmo_project, run_name, source
                )
                if existing:
                    target_run = existing
                    run_action = "use_existing"
                else:
                    run_action = "create_new"
            except Exception as exc:
                logger.warning("Failed to search automation run", extra={"error": str(exc)})
                run_action = "create_new"

        # Map issues to frontend-compatible preview items
        status_counts: dict[str, int] = {}
        preview_issues = []
        to_create = to_update = to_skip = 0

        for issue in issues:
            status = map_issue_to_testmo_status(issue)
            status_counts[status] = status_counts.get(status, 0) + 1

            # Frontend-compatible status mapping
            if status in ("passed", "skipped"):
                frontend_status = "skip"
                to_skip += 1
            elif status == "failed":
                frontend_status = "update"
                to_update += 1
            else:
                frontend_status = "create"
                to_create += 1

            preview_issues.append({
                "iid": issue.get("iid"),
                "url": issue.get("web_url", ""),
                "title": issue.get("title", ""),
                "status": frontend_status,
            })

        return {
            "iteration": {"name": iteration.get("title"), "id": iteration.get("id")},
            "folder": None,
            "issues": preview_issues,
            "summary": {
                "toCreate": to_create,
                "toUpdate": to_update,
                "toSkip": to_skip,
                "total": len(issues),
            },
            "run_action": run_action,
            "target_run": {
                "id": target_run.get("id") if target_run else None,
                "name": target_run.get("name") if target_run else build_run_name(iteration_name, version),
                "source": source,
            },
            "status_breakdown": status_counts,
            "version": version,
        }

    async def execute_sync(
        self,
        project_id: str | int,
        iteration_name: str,
        run_id: int | None = None,
        version: str | None = None,
        dry_run: bool = False,
        source: str = "gitlab-sync",
        testmo_project_id: int | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Execute sync and yield log events for SSE."""
        tmo_project = testmo_project_id or settings.testmo_project_id
        testmo_run_id: int | None = None
        testmo_thread_id: int | None = None
        run_url: str | None = None

        yield {"level": "info", "message": f"Starting sync for iteration '{iteration_name}'"}
        await asyncio.sleep(0.2)

        iteration = await gitlab_service.find_iteration(project_id, iteration_name)
        if not iteration:
            yield {"level": "error", "message": f"Iteration '{iteration_name}' not found"}
            return

        yield {"level": "info", "message": f"Found iteration: {iteration['title']}"}

        issues = await gitlab_service.get_issues_by_label_and_iteration(
            project_id, "QA", iteration["id"]
        )
        yield {"level": "info", "message": f"Found {len(issues)} issues with label QA"}

        if not issues:
            yield {"level": "info", "message": "No issues to sync"}
            yield {
                "level": "summary",
                "created": 0,
                "updated": 0,
                "skipped": 0,
                "enriched": 0,
                "errors": 0,
                "total_issues": 0,
                "testmo_run_id": None,
                "testmo_run_url": None,
            }
            return

        # ------------------------------------------------------------------
        # Find or create the target automation run
        # ------------------------------------------------------------------
        if not dry_run:
            try:
                if run_id:
                    # Verify automation run exists (will raise if not)
                    run_details = await testmo_service.get_automation_run_details(run_id)
                    testmo_run_id = run_details.get("id")
                    yield {"level": "info", "message": f"Using existing automation run #{testmo_run_id}"}
                else:
                    run_name = build_run_name(iteration_name, version)
                    existing = await testmo_service.find_automation_run(
                        tmo_project, run_name, source
                    )
                    if existing:
                        testmo_run_id = existing.get("id")
                        yield {"level": "info", "message": f"Using existing automation run '{run_name}' (#{testmo_run_id})"}
                    else:
                        created = await testmo_service.create_automation_run(
                            project_id=tmo_project,
                            name=run_name,
                            source=source,
                            tags=["gitlab-sync", iteration_name],
                        )
                        testmo_run_id = created.get("id")
                        yield {"level": "info", "message": f"Created automation run '{run_name}' (#{testmo_run_id})"}

                if testmo_run_id:
                    run_url = build_run_url(testmo_run_id)
                    # Create a thread for this sync execution
                    thread = await testmo_service.create_automation_thread(testmo_run_id)
                    testmo_thread_id = thread.get("id")
                    yield {"level": "info", "message": f"Created thread #{testmo_thread_id} in run #{testmo_run_id}"}
            except Exception as exc:
                logger.error("Failed to prepare Testmo run", extra={"error": str(exc)})
                yield {"level": "error", "message": f"Failed to prepare Testmo run: {exc}"}
                return

        # ------------------------------------------------------------------
        # Map issues to Testmo tests and push in batches
        # ------------------------------------------------------------------
        created = updated = skipped = enriched = errors = 0
        tests: list[dict[str, Any]] = []
        folder = iteration_name
        if version:
            folder = f"{folder} / {version}"

        for issue in issues:
            tests.append(build_testmo_test(issue, project_id, folder=folder))

        if not dry_run and testmo_thread_id is not None:
            total_batches = (len(tests) + TESTMO_BATCH_SIZE - 1) // TESTMO_BATCH_SIZE
            for batch_idx in range(total_batches):
                start = batch_idx * TESTMO_BATCH_SIZE
                end = start + TESTMO_BATCH_SIZE
                batch = tests[start:end]
                try:
                    await testmo_service.append_test_results(
                        thread_id=testmo_thread_id,
                        tests=batch,
                    )
                    yield {
                        "level": "debug",
                        "message": f"Pushed batch {batch_idx + 1}/{total_batches} ({len(batch)} tests)",
                    }
                except Exception as exc:
                    errors += len(batch)
                    logger.error("Failed to push test batch", extra={
                        "batch": batch_idx + 1,
                        "error": str(exc),
                    })
                    yield {"level": "error", "message": f"Batch {batch_idx + 1}/{total_batches} failed: {exc}"}
                await asyncio.sleep(0.1)

            # Complete thread and run
            try:
                await testmo_service.complete_automation_run(testmo_run_id, measure_elapsed=True)
                yield {"level": "info", "message": f"Automation run #{testmo_run_id} completed"}
            except Exception as exc:
                logger.error("Failed to complete automation run", extra={"error": str(exc)})
                yield {"level": "error", "message": f"Failed to complete run: {exc}"}

        # ------------------------------------------------------------------
        # Update GitLab labels (existing behavior preserved)
        # ------------------------------------------------------------------
        for issue in issues:
            iid = issue.get("iid")
            title = issue.get("title", "")
            try:
                if not dry_run:
                    if issue.get("state") == "opened":
                        await gitlab_service.update_issue_label(
                            project_id, iid, add_labels=["Sync-Updated"], remove_labels=[]
                        )
                        updated += 1
                    else:
                        skipped += 1
                else:
                    skipped += 1
                yield {"level": "debug", "message": f"Processed issue #{iid}: {title[:50]}"}
            except Exception as exc:
                errors += 1
                yield {"level": "error", "message": f"Failed issue #{iid}: {exc}"}
            await asyncio.sleep(0.05)

        total = len(issues)
        yield {"level": "info", "message": "Sync complete"}
        yield {
            "level": "summary",
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "enriched": enriched,
            "errors": errors,
            "total_issues": total,
            "testmo_run_id": testmo_run_id,
            "testmo_run_url": run_url,
        }

    async def sync_status_to_gitlab(
        self,
        project_id: str | int,
        iteration_name: str,
        run_id: int | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Sync Testmo run status back to GitLab issues."""
        yield {"level": "info", "message": f"Starting status sync for iteration '{iteration_name}'"}
        await asyncio.sleep(0.2)

        iteration = await gitlab_service.find_iteration(project_id, iteration_name)
        if not iteration:
            yield {"level": "error", "message": f"Iteration '{iteration_name}' not found"}
            return

        issues = await gitlab_service.get_issues_by_label_and_iteration(
            project_id, "QA", iteration["id"]
        )
        yield {"level": "info", "message": f"Found {len(issues)} issues"}

        if run_id:
            run = await testmo_service.get_run_details(run_id)
            run_name = run.get("name", "Unknown")
            for issue in issues:
                iid = issue.get("iid")
                try:
                    body = f"Testmo run **{run_name}** status updated."
                    await gitlab_service.add_issue_comment(project_id, iid, body)
                    yield {"level": "debug", "message": f"Updated issue #{iid}"}
                except Exception as exc:
                    yield {"level": "error", "message": f"Failed issue #{iid}: {exc}"}
                await asyncio.sleep(0.05)

        yield {"level": "info", "message": "Status sync complete"}
        yield {"level": "summary", "updated": len(issues)}

    async def get_history(self, db_session: Any) -> list[dict[str, Any]]:
        from sqlalchemy import select
        result = await db_session.execute(select(SyncRun).order_by(SyncRun.executed_at.desc()).limit(50))
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "project_name": r.project_name,
                "iteration_name": r.iteration_name,
                "mode": r.mode,
                "created": r.created,
                "updated": r.updated,
                "skipped": r.skipped,
                "enriched": r.enriched,
                "errors": r.errors,
                "total_issues": r.total_issues,
                "testmo_run_id": r.testmo_run_id,
                "testmo_run_url": r.testmo_run_url,
                "executed_at": r.executed_at.isoformat() if r.executed_at else None,
            }
            for r in rows
        ]

    async def persist_run(
        self,
        db_session: Any,
        project_name: str,
        iteration_name: str | None,
        stats: dict[str, int],
    ) -> None:
        run = SyncRun(
            project_name=project_name,
            iteration_name=iteration_name,
            created=stats.get("created", 0),
            updated=stats.get("updated", 0),
            skipped=stats.get("skipped", 0),
            enriched=stats.get("enriched", 0),
            errors=stats.get("errors", 0),
            total_issues=stats.get("total_issues", 0),
            testmo_run_id=stats.get("testmo_run_id"),
            testmo_run_url=stats.get("testmo_run_url"),
        )
        db_session.add(run)
        await db_session.commit()

    def get_auto_config(self) -> dict[str, Any]:
        return {
            "enabled": settings.sync_auto_enabled,
            "timezone": settings.sync_timezone,
            "run_id": settings.sync_auto_run_id,
            "iteration_name": settings.sync_auto_iteration_name,
            "gitlab_project_id": settings.sync_auto_gitlab_project_id,
            "version": settings.sync_auto_version,
        }

    async def update_auto_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        # In-memory update only (env vars would need restart)
        # We return the merged config; a real implementation might write to DB.
        return {
            "enabled": payload.get("enabled", settings.sync_auto_enabled),
            "timezone": payload.get("timezone", settings.sync_timezone),
            "run_id": payload.get("run_id", settings.sync_auto_run_id),
            "iteration_name": payload.get("iteration_name", settings.sync_auto_iteration_name),
            "gitlab_project_id": payload.get("gitlab_project_id", settings.sync_auto_gitlab_project_id),
            "version": payload.get("version", settings.sync_auto_version),
        }


sync_service = SyncService()
