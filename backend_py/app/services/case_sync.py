"""Case sync orchestration — GitLab issues → Testmo cases (Routine B)."""

from __future__ import annotations

import asyncio
import html
import markdown  # type: ignore[import-untyped]
import os
import re
from dataclasses import dataclass, field
from typing import Any, cast
from urllib.parse import urlparse

from app.config import settings
from app.models.sync_history import SyncCaseRun
from app.projects_config import resolve_gitlab_integration_info, resolve_testmo_repo_id
from app.services.gitlab import gitlab_service
from app.services.sync_mapper import extract_steps_from_notes
from app.services.testmo import testmo_service
from app.utils.api_helpers import SAFE_INTERNAL_ERROR
from app.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class SyncCaseResult:
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: int = 0
    folder_id: int | None = None
    folder_name: str | None = None
    details: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "errors": self.errors,
            "folder_id": self.folder_id,
            "folder_name": self.folder_name,
            "details": self.details,
        }


def _normalize_steps(steps: list[dict[str, Any]] | None) -> str:
    """Flatten custom_steps into a comparable string (unescape HTML entities)."""
    if not steps:
        return ""
    parts: list[str] = []
    for s in steps:
        for key in ("text1", "text2", "text3"):
            val = s.get(key)
            if val:
                parts.append(html.unescape(str(val)).strip())
    return "\n".join(parts)


def _is_case_identical(existing: dict[str, Any], payload: dict[str, Any]) -> bool:
    """Return True if existing Testmo case matches the new payload."""
    if existing.get("name") != payload.get("name"):
        return False
    existing_desc = html.unescape((existing.get("custom_description") or "").strip())
    payload_desc = html.unescape((payload.get("custom_description") or "").strip())
    if _extract_text_from_html(existing_desc) != _extract_text_from_html(payload_desc):
        return False
    # Force update when description has images but case has no attachments yet.
    # This ensures images are uploaded to Testmo on the next sync.
    if "<img" in payload_desc and not existing.get("attachments"):
        return False
    if existing.get("estimate") != payload.get("estimate"):
        return False
    if _normalize_steps(existing.get("custom_steps")) != _normalize_steps(
        payload.get("custom_steps")
    ):
        return False
    return True


def is_case_enriched(case: dict[str, Any]) -> bool:
    """Return True if a case has been manually enriched and should not be overwritten."""
    if case.get("estimate"):
        return True
    if case.get("issues"):
        return True
    tags = case.get("tags", []) or []
    manual_tags = [
        t
        for t in tags
        if not any(str(t).startswith(p) for p in ("gitlab-", "iteration-", "sync-auto"))
    ]
    if manual_tags:
        return True
    if case.get("custom_priority") and case.get("custom_priority") != "Normal":
        return True
    steps = case.get("custom_steps", []) or []
    if steps and any(s.get("text1") for s in steps):
        return True
    return False


# ------------------------------------------------------------------
# Image extraction from markdown descriptions
# ------------------------------------------------------------------

IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


def extract_image_urls(md_text: str) -> list[str]:
    """Extract image URLs from markdown text."""
    return [m.group(2).strip() for m in IMAGE_RE.finditer(md_text)]


def replace_image_urls_in_html(html_text: str, url_map: dict[str, str]) -> str:
    """Replace image URLs in HTML with their mapped counterparts."""
    for old_url, new_url in url_map.items():
        html_text = html_text.replace(old_url, new_url)
    return html_text


def _extract_text_from_html(html: str) -> str:
    """Extract plain text from HTML for comparison (ignores all tags)."""
    text = re.sub(r"<[^>]+>", "", html)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _normalize_attachment_url(path: str) -> str:
    """Ensure Testmo attachment URL is absolute and usable."""
    if not path:
        return path
    if path.startswith("/"):
        return f"{settings.testmo_url.rstrip('/')}{path}"
    # Some Testmo instances return localhost in the path field when
    # the APP_URL is misconfigured. Try to fix it gracefully.
    for bad in ("http://localhost", "https://localhost"):
        if path.startswith(bad):
            return settings.testmo_url.rstrip("/") + path[len(bad) :]
    return path


async def _sync_case_images(
    case_id: int,
    description_md: str,
    current_html: str,
) -> str:
    """Download images from GitLab and upload them as Testmo attachments."""
    image_urls = extract_image_urls(description_md)
    if not image_urls:
        return current_html

    url_map: dict[str, str] = {}
    for url in image_urls:
        try:
            file_bytes = await gitlab_service.download_upload(url)
            parsed = urlparse(url)
            filename = os.path.basename(parsed.path) or "image.png"
            ext = os.path.splitext(filename)[1].lower()
            mime_type = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".webp": "image/webp",
                ".svg": "image/svg+xml",
            }.get(ext, "image/png")

            attachment_resp = await testmo_service.upload_attachment(
                case_id, file_bytes, filename, mime_type
            )
            result = attachment_resp.get("result", [])
            if result and len(result) > 0:
                new_url = _normalize_attachment_url(result[0].get("path", ""))
                if new_url:
                    url_map[url] = new_url
        except Exception as exc:
            logger.warning("Failed to sync image", extra={"url": url, "error": str(exc)})

    if url_map:
        return replace_image_urls_in_html(current_html, url_map)
    return current_html


def build_case_payload(
    issue: dict[str, Any],
    notes: list[dict[str, Any]],
    folder_id: int,
    gitlab_project_id: int | str,
    iteration_name: str,
    folder_name: str | None = None,
    gitlab_integration_id: int | None = None,
    gitlab_connection_project_id: int | None = None,
) -> dict[str, Any]:
    """Build a Testmo case payload from a GitLab issue and its notes."""
    title = issue.get("title", "")
    description = issue.get("description") or ""
    iid = issue.get("iid")
    time_estimate = issue.get("time_estimate")

    payload: dict[str, Any] = {
        "name": title,
        "folder_id": folder_id,
    }

    def _sanitize_tag(tag: str) -> str:
        return re.sub(r"[^a-zA-Z0-9_\-]", "_", tag)

    tag_name = _sanitize_tag(folder_name or iteration_name or "sync")
    tags = [
        "gitlab-sync",
        _sanitize_tag(f"gitlab-{gitlab_project_id}-{iid}"),
        f"iteration-{tag_name}",
    ]
    payload["tags"] = tags

    if time_estimate:
        payload["estimate"] = time_estimate

    if description:
        max_desc = 2000
        truncated = description[:max_desc] + "…" if len(description) > max_desc else description
        payload["custom_description"] = markdown.markdown(truncated.strip())

    steps = extract_steps_from_notes(notes)
    if steps:
        payload["custom_steps"] = steps

    # Link case to GitLab issue
    if iid and gitlab_integration_id and gitlab_connection_project_id:
        payload["issues"] = [
            {
                "display_id": str(iid),
                "integration_id": gitlab_integration_id,
                "connection_project_id": gitlab_connection_project_id,
            }
        ]

    return payload


def _parse_folder_hierarchy(iteration_name: str) -> tuple[str | None, str]:
    """Parse iteration name into (parent_name, child_name).

    Ex: ``'R06 - run 1'`` → ``('R06', 'R06 - run 1')``
    """
    if " - " in iteration_name:
        parent = iteration_name.split(" - ")[0].strip()
        return parent, iteration_name
    return None, iteration_name


class CaseSyncService:
    async def sync_iteration(
        self,
        gitlab_project_id: int | str,
        testmo_project_id: int,
        iteration_name: str = "",
        label: str = "Test::TODO",
        root_folder_id: int = 4514,
        dry_run: bool = False,
        logical_project_id: str | int | None = None,
        gitlab_status: str | None = None,
        version_prod: str | None = None,
        run_name: str | None = None,
    ) -> SyncCaseResult:
        """Sync GitLab issues for an iteration into Testmo cases."""
        result = SyncCaseResult()

        # Resolve GitLab integration info for Testmo issue linking
        integration_info = (
            resolve_gitlab_integration_info(logical_project_id)
            if logical_project_id
            else {"integration_id": None, "connection_project_id": None}
        )
        gitlab_integration_id = integration_info.get("integration_id")
        gitlab_connection_project_id = integration_info.get("connection_project_id")

        # Resolve Testmo repo id for folder creation
        testmo_repo_id = resolve_testmo_repo_id(logical_project_id) if logical_project_id else None

        # 1. Find iteration (optional)
        iteration_id = None
        if iteration_name and iteration_name.strip():
            try:
                iteration = await gitlab_service.find_iteration_for_project(
                    gitlab_project_id, iteration_name
                )
            except Exception as exc:
                logger.error("Failed to find iteration", extra={"error": str(exc)})
                result.errors += 1
                result.details.append({"error": f"GitLab API error: {exc}"})
                return result
            if not iteration:
                logger.error("Iteration not found", extra={"iteration_name": iteration_name})
                result.errors += 1
                result.details.append({"error": f"Iteration '{iteration_name}' not found"})
                return result
            iteration_id = iteration["id"]

        # 2. Fetch issues
        try:
            issues = await gitlab_service.get_issues_by_label_and_iteration(
                gitlab_project_id,
                label,
                iteration_id,
                gitlab_status=gitlab_status,
                version_prod=version_prod,
            )
        except Exception as exc:
            logger.error("Failed to fetch issues", extra={"error": str(exc)})
            result.errors += 1
            result.details.append({"error": f"Failed to fetch issues: {exc}"})
            return result

        if not issues:
            logger.info(
                "No issues to sync", extra={"iteration_name": iteration_name, "run_name": run_name}
            )
            return result

        # 3. Folder hierarchy
        folder_base_name = (
            (run_name or "").strip() or iteration_name.strip() or label.strip() or "sync"
        )
        parent_name, child_name = _parse_folder_hierarchy(folder_base_name)
        try:
            if dry_run:
                # Simulate folder hierarchy without writing to Testmo
                # Try to locate existing folder so we can compare cases accurately
                folder_id = None
                result.folder_name = child_name
                if parent_name:
                    result.folder_name = f"{parent_name} / {child_name}"
                    try:
                        parent_folder = await testmo_service._find_folder_by_name(
                            testmo_project_id,
                            parent_name,
                            parent_id=root_folder_id,
                            repo_id=testmo_repo_id,
                        )
                        if parent_folder:
                            target_folder = await testmo_service._find_folder_by_name(
                                testmo_project_id,
                                child_name,
                                parent_id=parent_folder.get("id"),
                                repo_id=testmo_repo_id,
                            )
                            if target_folder:
                                folder_id = target_folder.get("id")
                                result.folder_id = folder_id
                    except Exception as exc:
                        logger.warning("Dry-run folder lookup failed: %s", exc)
                else:
                    try:
                        target_folder = await testmo_service._find_folder_by_name(
                            testmo_project_id,
                            child_name,
                            parent_id=root_folder_id,
                            repo_id=testmo_repo_id,
                        )
                        if target_folder:
                            folder_id = target_folder.get("id")
                            result.folder_id = folder_id
                    except Exception as exc:
                        logger.warning("Dry-run folder lookup failed: %s", exc)
            else:
                if parent_name:
                    parent_folder = await testmo_service.get_or_create_folder(
                        testmo_project_id,
                        parent_name,
                        parent_id=root_folder_id,
                        repo_id=testmo_repo_id,
                    )
                    parent_id = parent_folder.get("id")
                else:
                    parent_id = root_folder_id

                target_folder = await testmo_service.get_or_create_folder(
                    testmo_project_id, child_name, parent_id=parent_id, repo_id=testmo_repo_id
                )
                folder_id = target_folder.get("id")
                result.folder_id = folder_id
                result.folder_name = target_folder.get("name")
        except Exception as exc:
            logger.error("Failed to prepare folder hierarchy", extra={"error": str(exc)})
            result.errors += len(issues)
            result.details.append({"error": f"Folder setup failed: {exc}"})
            return result

        # 4. Fetch existing cases in folder
        if dry_run and folder_id is None:
            # Skip fetching all project cases when previewing without a specific folder
            existing_cases: list[dict[str, Any]] = []
        else:
            try:
                existing_cases = await testmo_service.get_cases(
                    testmo_project_id, folder_id=folder_id
                )
                if getattr(existing_cases, "truncated", False):
                    logger.warning(
                        "Case list truncated for project %s (MAX_PAGES reached)", testmo_project_id
                    )
                    result.details.append(
                        {"warning": "Case list truncated — some existing cases may be missed."}
                    )
            except Exception as exc:
                logger.error("Failed to fetch existing cases", extra={"error": str(exc)})
                result.errors += len(issues)
                result.details.append({"error": f"Failed to fetch cases: {exc}"})
                return result

        cases_by_name: dict[str, dict[str, Any]] = {}
        for c in existing_cases:
            name = c.get("name")
            if name:
                cases_by_name[str(name)] = c
                # Match legacy cases that had [#iid] prefix in previous format
                clean_name = re.sub(r"^\[#\d+\]\s+", "", str(name))
                if clean_name != str(name):
                    cases_by_name[clean_name] = c

        # Limit preview to avoid timeouts on large projects
        MAX_PREVIEW_ISSUES = 20
        total_issues_before_truncate = len(issues)
        if dry_run and total_issues_before_truncate > MAX_PREVIEW_ISSUES:
            issues = issues[:MAX_PREVIEW_ISSUES]
            result.details.append(
                {
                    "info": f"Preview limité à {MAX_PREVIEW_ISSUES} issues (total: {total_issues_before_truncate}). Utilise un label ou une itération pour filtrer."
                }
            )

        # 5. Pre-fetch all notes in parallel
        note_tasks: list[Any] = []
        for issue in issues:
            iid = issue.get("iid")
            if iid is not None:
                note_tasks.append(gitlab_service.get_issue_notes(gitlab_project_id, cast(int, iid)))

        notes_results = await asyncio.gather(*note_tasks, return_exceptions=True)
        notes_by_iid: dict[int, list[dict[str, Any]]] = {}
        issues_with_iid = [issue for issue in issues if issue.get("iid") is not None]
        for issue, notes_res in zip(issues_with_iid, notes_results):
            iid = issue.get("iid")
            if isinstance(notes_res, Exception):
                logger.warning("Failed to fetch notes", extra={"iid": iid, "error": str(notes_res)})
                notes_by_iid[cast(int, iid)] = []
            else:
                notes_by_iid[cast(int, iid)] = notes_res

        # 6. Process each issue
        for issue in issues:
            iid = issue.get("iid")
            title = issue.get("title", "")
            detail: dict[str, Any] = {"iid": iid, "title": title}
            notes = notes_by_iid.get(cast(int, iid), [])

            payload = build_case_payload(
                issue,
                notes,
                cast(int, folder_id),
                gitlab_project_id,
                iteration_name,
                folder_name=folder_base_name,
                gitlab_integration_id=gitlab_integration_id,
                gitlab_connection_project_id=gitlab_connection_project_id,
            )

            try:
                existing = cases_by_name.get(title)

                if existing:
                    existing_issues = existing.get("issues", []) or []
                    has_issue_link = any(
                        str(issue.get("display_id", "")) == str(iid) for issue in existing_issues
                    )
                    if has_issue_link and is_case_enriched(existing):
                        result.skipped += 1
                        detail["action"] = "skipped"
                        detail["reason"] = "enriched"
                        result.details.append(detail)
                        continue

                    if _is_case_identical(existing, payload):
                        result.skipped += 1
                        detail["action"] = "skipped"
                        detail["reason"] = "identical"
                        result.details.append(detail)
                        continue
                    # Case exists but different: force update

                if dry_run:
                    detail["action"] = "update" if existing else "create"
                    result.details.append(detail)
                    if existing:
                        result.updated += 1
                    else:
                        result.created += 1
                    continue

                if existing:
                    case_id = cast(int, existing.get("id"))
                    await testmo_service.update_case(testmo_project_id, case_id, payload)
                    result.updated += 1
                    detail["action"] = "updated"
                    detail["case_id"] = case_id
                else:
                    created_cases = await testmo_service.create_cases(testmo_project_id, [payload])
                    result.created += 1
                    detail["action"] = "created"
                    if created_cases:
                        detail["case_id"] = created_cases[0].get("id")

                # Upload images to Testmo and update description with attachment URLs
                case_id = detail.get("case_id")
                description_md = issue.get("description") or ""
                if case_id and description_md:
                    try:
                        updated_html = await _sync_case_images(
                            case_id, description_md, payload.get("custom_description", "")
                        )
                        if updated_html != payload.get("custom_description", ""):
                            await testmo_service.update_case(
                                testmo_project_id, case_id, {"custom_description": updated_html}
                            )
                    except Exception as exc:
                        logger.warning(
                            "Failed to sync case images", extra={"iid": iid, "error": str(exc)}
                        )

                # Label GitLab
                try:
                    await gitlab_service.update_issue_label(
                        gitlab_project_id,
                        cast(int, iid),
                        add_labels=["Sync-Updated"],
                        remove_labels=[],
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to update GitLab label", extra={"iid": iid, "error": str(exc)}
                    )

                result.details.append(detail)

            except Exception as exc:
                logger.error("Failed to sync issue", extra={"iid": iid, "error": str(exc)})
                result.errors += 1
                detail["action"] = "error"
                detail["error"] = SAFE_INTERNAL_ERROR
                result.details.append(detail)

            await asyncio.sleep(0.3)

        return result

    async def preview_sync_iteration(
        self,
        gitlab_project_id: int | str,
        testmo_project_id: int,
        iteration_name: str = "",
        label: str = "Test::TODO",
        root_folder_id: int = 4514,
        logical_project_id: str | int | None = None,
        gitlab_status: str | None = None,
        version_prod: str | None = None,
        run_name: str | None = None,
    ) -> SyncCaseResult:
        """Dry-run version of sync_iteration."""
        return await self.sync_iteration(
            gitlab_project_id=gitlab_project_id,
            testmo_project_id=testmo_project_id,
            iteration_name=iteration_name,
            label=label,
            root_folder_id=root_folder_id,
            dry_run=True,
            logical_project_id=logical_project_id,
            gitlab_status=gitlab_status,
            version_prod=version_prod,
            run_name=run_name,
        )

    async def persist_case_run(
        self,
        db_session: Any,
        project_id: int,
        iteration_name: str,
        folder_id: int | None,
        result: SyncCaseResult,
    ) -> None:
        """Persist a case sync result to the database."""
        run = SyncCaseRun(
            project_id=project_id,
            iteration_name=iteration_name,
            folder_id=folder_id,
            stats_created=result.created,
            stats_updated=result.updated,
            stats_skipped=result.skipped,
            stats_errors=result.errors,
            details=result.details,
        )
        db_session.add(run)
        await db_session.commit()

    async def get_history(self, db_session: Any, limit: int = 50) -> list[dict[str, Any]]:
        from sqlalchemy import select

        result = await db_session.execute(
            select(SyncCaseRun).order_by(SyncCaseRun.created_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "project_id": r.project_id,
                "iteration_name": r.iteration_name,
                "folder_id": r.folder_id,
                "created": r.stats_created,
                "updated": r.stats_updated,
                "skipped": r.stats_skipped,
                "errors": r.stats_errors,
                "details": r.details,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


case_sync_service = CaseSyncService()
