"""GitLab ↔ Testmo sync orchestration."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Any

from sqlalchemy import select

from app.config import settings
from app.database import get_main_db
from app.models.sync_history import AutoSyncConfig, SyncRun
from app.projects_config import SYNC_PROJECTS, resolve_gitlab_project_id
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
        """Return configured sync projects for Dashboard 6 frontend."""
        return [
            {
                "id": p["id"],
                "label": p["label"],
                "configured": p["configured"],
                "testmo_project_id": p.get("testmo", {}).get("projectId"),
                "gitlab_project_id": p.get("gitlab", {}).get("projectId"),
            }
            for p in SYNC_PROJECTS
        ]

    async def list_iterations(
        self, project_id: str | int, search: str | None = None
    ) -> list[dict[str, Any]]:
        gl_project_id = resolve_gitlab_project_id(project_id)
        if not gl_project_id:
            return []
        # Récupère toutes les itérations sans search (les cadences auto ont title=null)
        iterations = await gitlab_service.get_project_iterations(gl_project_id, search=None)

        def _fmt_date(d: str | None) -> str:
            if not d:
                return "?"
            try:
                dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
                return dt.strftime("%d/%m")
            except ValueError:
                return "?"

        result: list[dict[str, Any]] = []
        for it in iterations:
            title = it.get("title")
            if not title:
                iid = it.get("iid") or it.get("sequence") or it.get("id")
                title = f"Itération #{iid} ({_fmt_date(it.get('start_date'))} → {_fmt_date(it.get('due_date'))})"
            result.append(
                {
                    "id": it.get("id"),
                    "title": title,
                    "start_date": it.get("start_date"),
                    "due_date": it.get("due_date"),
                    "state": it.get("state"),
                }
            )

        # Trier par iid décroissant (plus récente en premier)
        result.sort(key=lambda x: x.get("id") or 0, reverse=True)

        # Filtrer localement par search si fourni
        if search:
            q = search.lower()
            result = [it for it in result if q in (it.get("title") or "").lower()]

        return result

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

        gl_project_id = resolve_gitlab_project_id(project_id)
        if not gl_project_id:
            return {"error": f"Project '{project_id}' not configured"}

        iteration = await gitlab_service.find_iteration_for_project(gl_project_id, iteration_name)
        if not iteration:
            return {"error": f"Iteration '{iteration_name}' not found"}

        issues = await gitlab_service.get_issues_by_label_and_iteration(
            gl_project_id, "QA", iteration["id"]
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
                existing = await testmo_service.find_automation_run(tmo_project, run_name, source)
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

            preview_issues.append(
                {
                    "iid": issue.get("iid"),
                    "url": issue.get("web_url", ""),
                    "title": issue.get("title", ""),
                    "status": frontend_status,
                }
            )

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
                "name": target_run.get("name")
                if target_run
                else build_run_name(iteration_name, version),
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

        gl_project_id = resolve_gitlab_project_id(project_id)
        if not gl_project_id:
            yield {"level": "error", "message": f"Project '{project_id}' not configured"}
            return

        iteration = await gitlab_service.find_iteration_for_project(gl_project_id, iteration_name)
        if not iteration:
            yield {"level": "error", "message": f"Iteration '{iteration_name}' not found"}
            return

        yield {"level": "info", "message": f"Found iteration: {iteration['title']}"}

        issues = await gitlab_service.get_issues_by_label_and_iteration(
            gl_project_id, "QA", iteration["id"]
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
        created: dict[str, Any] | None = None
        if not dry_run:
            try:
                if run_id:
                    # Verify automation run exists (will raise if not)
                    run_details = await testmo_service.get_automation_run_details(run_id)
                    testmo_run_id = run_details.get("id")
                    yield {
                        "level": "info",
                        "message": f"Using existing automation run #{testmo_run_id}",
                    }
                else:
                    run_name = build_run_name(iteration_name, version)
                    existing = await testmo_service.find_automation_run(
                        tmo_project, run_name, source
                    )
                    if existing:
                        testmo_run_id = existing.get("id")
                        yield {
                            "level": "info",
                            "message": f"Using existing automation run '{run_name}' (#{testmo_run_id})",
                        }
                    else:
                        created = await testmo_service.create_automation_run(
                            project_id=tmo_project,
                            name=run_name,
                            source=source,
                            tags=["gitlab-sync", iteration_name],
                        )
                        testmo_run_id = created.get("id")
                        yield {
                            "level": "info",
                            "message": f"Created automation run '{run_name}' (#{testmo_run_id})",
                        }

                if testmo_run_id:
                    run_url = build_run_url(testmo_run_id)
                    # Create a thread for this sync execution
                    thread = await testmo_service.create_automation_thread(testmo_run_id)
                    testmo_thread_id = thread.get("id")
                    yield {
                        "level": "info",
                        "message": f"Created thread #{testmo_thread_id} in run #{testmo_run_id}",
                    }
            except Exception as exc:
                logger.error("Failed to prepare Testmo run", extra={"error": str(exc)})
                yield {"level": "error", "message": f"Failed to prepare Testmo run: {exc}"}
                return

        # ------------------------------------------------------------------
        # Map issues to Testmo tests and push in batches
        # ------------------------------------------------------------------
        updated = skipped = enriched = errors = 0
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
                    logger.error(
                        "Failed to push test batch",
                        extra={
                            "batch": batch_idx + 1,
                            "error": str(exc),
                        },
                    )
                    yield {
                        "level": "error",
                        "message": f"Batch {batch_idx + 1}/{total_batches} failed",
                    }
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
            try:
                iid_int = int(iid)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                logger.warning(
                    "Skipping issue with invalid iid %r: %s", iid, issue.get("title", "")
                )
                skipped += 1
                continue
            title = issue.get("title", "")
            try:
                if not dry_run:
                    if issue.get("state") == "opened":
                        await gitlab_service.update_issue_label(
                            project_id, iid_int, add_labels=["Sync-Updated"], remove_labels=[]
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
            "created": 1 if created else 0,
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
        dry_run: bool = False,
        version: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Sync Testmo run status back to GitLab issues."""
        from app.services.status_sync import status_sync_service

        async for event in status_sync_service.sync_run_status_to_gitlab(
            run_id=run_id or 0,
            iteration_name=iteration_name,
            gitlab_project_id=project_id,
            dry_run=dry_run,
            version=version,
        ):
            yield event

    async def get_history(self, db_session: Any) -> list[dict[str, Any]]:
        from sqlalchemy import select

        result = await db_session.execute(
            select(SyncRun).order_by(SyncRun.executed_at.desc()).limit(50)
        )
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

    async def get_auto_config(self) -> dict[str, Any]:
        async with get_main_db() as db:
            result = await db.execute(select(AutoSyncConfig))
            config = result.scalar_one_or_none()
            if config:
                return {
                    "enabled": config.enabled,
                    "mode": config.mode,
                    "timezone": config.timezone,
                    "run_id": config.run_id,
                    "iteration_name": config.iteration_name,
                    "gitlab_project_id": config.gitlab_project_id,
                    "testmo_project_id": config.testmo_project_id,
                    "version": config.version,
                    "label": config.label,
                    "gitlab_status": config.gitlab_status,
                    "version_prod": config.version_prod,
                    "version_test": config.version_test,
                }
        # Fallback to settings if no DB row
        return {
            "enabled": settings.sync_auto_enabled,
            "mode": "automation",
            "timezone": settings.sync_timezone,
            "run_id": settings.sync_auto_run_id,
            "iteration_name": settings.sync_auto_iteration_name,
            "gitlab_project_id": settings.sync_auto_gitlab_project_id,
            "testmo_project_id": settings.testmo_project_id,
            "version": settings.sync_auto_version,
            "label": None,
            "gitlab_status": None,
            "version_prod": None,
            "version_test": None,
        }

    async def update_auto_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        async with get_main_db() as db:
            result = await db.execute(select(AutoSyncConfig))
            config = result.scalar_one_or_none()
            if not config:
                config = AutoSyncConfig()
                db.add(config)
            if "enabled" in payload:
                config.enabled = bool(payload["enabled"])
            if "mode" in payload:
                config.mode = str(payload["mode"])
            if "timezone" in payload:
                config.timezone = str(payload["timezone"])
            if "run_id" in payload:
                config.run_id = int(payload["run_id"]) if payload["run_id"] is not None else None
            if "iteration_name" in payload:
                config.iteration_name = (
                    str(payload["iteration_name"]) if payload["iteration_name"] else None
                )
            if "gitlab_project_id" in payload:
                config.gitlab_project_id = (
                    str(payload["gitlab_project_id"]) if payload["gitlab_project_id"] else None
                )
            if "testmo_project_id" in payload:
                config.testmo_project_id = (
                    int(payload["testmo_project_id"])
                    if payload["testmo_project_id"] is not None
                    else None
                )
            if "version" in payload:
                config.version = str(payload["version"]) if payload["version"] else None
            if "label" in payload:
                config.label = str(payload["label"]) if payload["label"] else None
            if "gitlab_status" in payload:
                config.gitlab_status = (
                    str(payload["gitlab_status"]) if payload["gitlab_status"] else None
                )
            if "version_prod" in payload:
                config.version_prod = (
                    str(payload["version_prod"]) if payload["version_prod"] else None
                )
            if "version_test" in payload:
                config.version_test = (
                    str(payload["version_test"]) if payload["version_test"] else None
                )
            await db.commit()
            await db.refresh(config)
        return await self.get_auto_config()


sync_service = SyncService()
