"""Port of status-sync.service.ts — Sync Testmo run status to GitLab Work Items."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator
from typing import Any

from app.config import settings
from app.services.gitlab import gitlab_service
from app.services.testmo import testmo_service
from app.utils.api_helpers import SAFE_INTERNAL_ERROR
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ─── Constants ─────────────────────────────────────────────────────────────

STATUS_TO_LABEL = {
    2: "Test::OK",  # Passed
    3: "Test::KO",  # Failed
    4: "DoubleTestNécessaire",  # Retest
    8: "Test::WIP",  # WIP
}

STATUS_ID_TO_NAME = {
    2: "Passed",
    3: "Failed",
    4: "Retest",
    8: "WIP",
}

ALL_TEST_LABELS = [
    "Test::OK",
    "Test::KO",
    "Test::WIP",
    "Test::SKIPPED",
    "Test::BLOCKED",
    "DoubleTestNécessaire",
    "Test::TODO",
]

GITLAB_STATUS_TODO = os.getenv(
    "GITLAB_STATUS_TODO", "gid://gitlab/WorkItems::Statuses::Custom::Status/15"
)
GITLAB_STATUS_OK = os.getenv(
    "GITLAB_STATUS_OK", "gid://gitlab/WorkItems::Statuses::Custom::Status/18"
)
GITLAB_STATUS_KO = os.getenv(
    "GITLAB_STATUS_KO", "gid://gitlab/WorkItems::Statuses::Custom::Status/17"
)
GITLAB_STATUS_WIP = os.getenv(
    "GITLAB_STATUS_WIP", "gid://gitlab/WorkItems::Statuses::Custom::Status/21"
)
GITLAB_STATUS_RETEST = os.getenv(
    "GITLAB_STATUS_RETEST", "gid://gitlab/WorkItems::Statuses::Custom::Status/19"
)

STATUS_TO_GITLAB_STATUS = {
    2: GITLAB_STATUS_OK,
    3: GITLAB_STATUS_KO,
    4: GITLAB_STATUS_RETEST,
    8: GITLAB_STATUS_WIP,
}

# ─── Standalone helpers ────────────────────────────────────────────────────


def build_comment_text(run_name: str, status_id: int) -> str:
    status_name = STATUS_ID_TO_NAME.get(status_id, str(status_id))
    return (
        f"Commentaire ajouté automatiquement - Test sur le run: {run_name} - Status {status_name}"
    )


def is_comment_duplicate(existing_notes: list[dict[str, Any]], comment_text: str) -> bool:
    return any(n.get("body") == comment_text for n in existing_notes)


def compute_label_changes(current_labels: list[str], new_label: str | None) -> dict[str, Any]:
    if not new_label:
        return {"add_label": None, "remove_labels": [], "action": "skip"}
    labels_to_remove = [
        label for label in current_labels if label in ALL_TEST_LABELS and label != new_label
    ]
    already_has_label = new_label in current_labels
    if already_has_label and not labels_to_remove:
        return {"add_label": new_label, "remove_labels": [], "action": "noop"}
    return {"add_label": new_label, "remove_labels": labels_to_remove, "action": "update"}


def compute_status_change(current_status: str | None, new_status: str | None) -> dict[str, Any]:
    if not new_status:
        return {"new_status": None, "action": "skip"}
    if current_status == new_status:
        return {"new_status": new_status, "action": "noop"}
    return {"new_status": new_status, "action": "update"}


# ─── Service ───────────────────────────────────────────────────────────────


class StatusSyncService:
    def __init__(self) -> None:
        self.api_delay = 0.4  # 400ms between GitLab requests

    async def _delay(self) -> None:
        await asyncio.sleep(self.api_delay)

    # ─── Testmo API helpers ─────────────────────────────────────────────────

    async def _get_run_info(self, run_id: int) -> dict[str, Any]:
        data = await testmo_service.get_run_details(run_id)
        return data if isinstance(data, dict) else {}

    async def _get_run_results(self, run_id: int) -> list[dict[str, Any]]:
        return await testmo_service.get_run_results_paginated(run_id)

    async def _get_case_names(self, needed_ids: list[int]) -> dict[int, str]:
        project_id = settings.testmo_project_id or 1
        return await testmo_service.get_case_names(project_id, needed_ids)

    # ─── Commentaires GitLab ────────────────────────────────────────────────

    def _build_comment_text(self, run_name: str, status_id: int) -> str:
        status_name = STATUS_ID_TO_NAME.get(status_id, str(status_id))
        return f"Commentaire ajouté automatiquement - Test sur le run: {run_name} - Status {status_name}"

    async def _post_comment_if_needed(
        self, project_id: str | int, issue_iid: int, case_name: str, run_name: str, status_id: int
    ) -> None:
        comment_text = self._build_comment_text(run_name, status_id)
        try:
            existing_notes = await gitlab_service.get_issue_notes(project_id, issue_iid)
            if is_comment_duplicate(existing_notes, comment_text):
                logger.info(
                    '[StatusSync] Commentaire déjà présent sur #%s pour run="%s" status=%s — ignoré',
                    issue_iid,
                    run_name,
                    status_id,
                )
                return
            await gitlab_service.add_issue_comment(project_id, issue_iid, comment_text)
            logger.info(
                '[StatusSync] Commentaire ajouté sur #%s "%s" : "%s"',
                issue_iid,
                case_name,
                comment_text,
            )
        except Exception as exc:
            # Non-bloquant
            logger.error('[StatusSync] Erreur commentaire #%s "%s": %s', issue_iid, case_name, exc)

    # ─── Sync principale ─────────────────────────────────────────────────────

    async def sync_run_status_to_gitlab(
        self,
        run_id: int,
        iteration_name: str | None,
        gitlab_project_id: str | int,
        version: str | None = None,
        dry_run: bool = False,
    ) -> AsyncGenerator[dict[str, Any], None]:
        stats = {"updated": 0, "skipped": 0, "errors": 0, "total": 0, "dry_run": dry_run}

        yield {
            "level": "info",
            "message": (
                f'Démarrage sync Testmo run #{run_id} → GitLab "{iteration_name}"'
                f"{' [DRY-RUN — aucune modif GitLab]' if dry_run else ''}"
            ),
        }
        logger.info(
            '[StatusSync] run=%s, iteration="%s", glProject=%s',
            run_id,
            iteration_name,
            gitlab_project_id,
        )

        # 0. Nom du run Testmo
        yield {"level": "info", "message": "Récupération du nom du run Testmo…"}
        run_name = f"Run #{run_id}"
        try:
            run_info = await self._get_run_info(run_id)
            run_name = run_info.get("name") or run_name
            yield {"level": "info", "message": f'Run Testmo : "{run_name}"'}
        except Exception as exc:
            logger.warning("[StatusSync] Impossible de récupérer le nom du run %s: %s", run_id, exc)

        # 1. Résultats Testmo (is_latest)
        yield {"level": "info", "message": "Récupération des résultats Testmo…"}
        try:
            results = await self._get_run_results(run_id)
        except Exception as exc:
            yield {"level": "error", "message": f"Erreur récupération résultats Testmo: {exc}"}
            return

        if getattr(results, "truncated", False):
            yield {
                "level": "warn",
                "message": "Résultats Testmo tronqués (limite de pagination atteinte).",
            }

        if not results:
            yield {"level": "warn", "message": "Aucun résultat trouvé dans ce run."}
            return
        yield {"level": "info", "message": f"{len(results)} résultat(s) Testmo trouvé(s)."}

        # Récupère les noms de cases
        yield {"level": "info", "message": "Résolution des noms de cases Testmo…"}
        needed_ids = list({r.get("case_id") for r in results if r.get("case_id")})
        case_names = await self._get_case_names(needed_ids)
        yield {
            "level": "info",
            "message": f"{len(case_names)}/{len(needed_ids)} noms de cases résolus.",
        }

        # 2. Issues GitLab — mode itération ou mode version-seule
        issues: list[dict[str, Any]] = []
        if iteration_name:
            yield {"level": "info", "message": f'Recherche itération GitLab "{iteration_name}"…'}
            iteration = await gitlab_service.find_iteration_for_project(
                gitlab_project_id, iteration_name
            )
            if not iteration:
                yield {
                    "level": "error",
                    "message": (
                        f'Itération GitLab "{iteration_name}" non trouvée '
                        f"dans le projet {gitlab_project_id}"
                    ),
                }
                return
            yield {
                "level": "info",
                "message": (
                    f"Récupération des issues GitLab pour l'itération {iteration['id']}"
                    f"{f' (version={version})' if version else ''}…"
                ),
            }
            if version:
                issues = await gitlab_service.get_issues_by_version_and_iteration(
                    gitlab_project_id, version, iteration["id"]
                )
            else:
                issues = await gitlab_service.get_issues_for_iteration(
                    gitlab_project_id, iteration["id"]
                )
        elif version:
            yield {
                "level": "info",
                "message": (
                    f'Mode version-seule : recherche des issues avec Version Prod="{version}" '
                    "+ status Test TODO…"
                ),
            }
            issues = await gitlab_service.get_issues_by_version_only(gitlab_project_id, version)
        else:
            yield {"level": "error", "message": "iteration_name ou version requis"}
            return

        if not issues:
            yield {"level": "warn", "message": "Aucune issue GitLab trouvée."}
            logger.warning(
                "[StatusSync] Aucune issue trouvée (version=%s, project=%s)",
                version,
                gitlab_project_id,
            )
            return

        # Index issues par titre normalisé
        def _normalize(s: str | None) -> str:
            return (s or "").lower().strip()

        issue_by_title: dict[str, dict[str, Any]] = {}
        for issue in issues:
            issue_by_title[_normalize(issue.get("title"))] = issue
        yield {"level": "info", "message": f"{len(issues)} issue(s) GitLab indexée(s)."}
        logger.info(
            "[StatusSync] Issues trouvées : %s",
            ", ".join(f"#{i.get('iid')} '{i.get('title')}'" for i in issues),
        )

        # 3. Appliquer les statuts Work Item via GraphQL
        stats["total"] = len(results)

        # Pré-collecter les fallback searches et les exécuter en parallèle
        missing_case_names: list[str] = []
        for result in results:
            case_name = result.get("case_name") or case_names.get(result.get("case_id"))
            if case_name and _normalize(case_name) not in issue_by_title:
                missing_case_names.append(case_name)

        if missing_case_names:
            logger.info(
                "[StatusSync] %s case(s) non trouvées par titre exact, lancement fallback search…",
                len(missing_case_names),
            )
            search_tasks = [
                gitlab_service.search_issue_by_title(gitlab_project_id, name)
                for name in missing_case_names
            ]
            search_results = await asyncio.gather(*search_tasks, return_exceptions=True)
            for name, found in zip(missing_case_names, search_results):
                if isinstance(found, Exception):
                    logger.warning("[StatusSync] Fallback search failed for %s: %s", name, found)
                    continue
                if found:
                    issue_by_title[_normalize(name)] = found
                    logger.info(
                        '[StatusSync] Case "%s" retrouvé hors itération via fallback (issue #%s)',
                        name,
                        found.get("iid"),
                    )
                else:
                    logger.info('[StatusSync] Case "%s" introuvable même via fallback search', name)

        for result in results:
            status_id = result.get("status_id")
            new_status = STATUS_TO_GITLAB_STATUS.get(status_id)

            case_name = result.get("case_name") or case_names.get(result.get("case_id"))
            if not case_name:
                stats["skipped"] += 1
                continue

            issue = issue_by_title.get(_normalize(case_name))
            if not issue:
                logger.info(
                    '[StatusSync] Pas d\'issue GitLab pour case "%s" — ignoré '
                    "(titres indexés : %s)",
                    case_name,
                    list(issue_by_title.keys()),
                )
                stats["skipped"] += 1
                yield {
                    "level": "skip",
                    "caseName": case_name,
                    "reason": "aucune issue GitLab ne correspond à ce titre",
                }
                continue

            if not new_status:
                stats["skipped"] += 1
                yield {
                    "level": "skip",
                    "caseName": case_name,
                    "reason": f"statut Testmo {status_id} non mappé",
                }
                continue

            work_item_global_id = f"gid://gitlab/WorkItem/{issue['id']}"
            issue_state = issue.get("state", "unknown")

            if issue_state == "closed":
                logger.info(
                    '[StatusSync] Issue #%s "%s" is CLOSED — status update may fail or be ignored by GitLab',
                    issue.get("iid"),
                    case_name,
                )

            if dry_run:
                stats["updated"] += 1
                yield {
                    "level": "would-update",
                    "caseName": case_name,
                    "issueIid": issue.get("iid"),
                    "workItemGlobalId": work_item_global_id,
                    "newStatus": new_status,
                }
                continue

            try:
                await gitlab_service.update_work_item_status(work_item_global_id, new_status)
                stats["updated"] += 1
                yield {
                    "level": "updated",
                    "caseName": case_name,
                    "issueIid": issue.get("iid"),
                    "newStatus": new_status,
                }
                logger.info(
                    '[StatusSync] #%s "%s" → status:%s', issue.get("iid"), case_name, new_status
                )

                issue_iid = issue.get("iid")
                try:
                    issue_iid_int = int(issue_iid)  # type: ignore[arg-type]
                except (TypeError, ValueError):
                    logger.warning(
                        "[StatusSync] Invalid iid %r for case '%s' — skipping comment",
                        issue_iid,
                        case_name,
                    )
                else:
                    await self._post_comment_if_needed(
                        gitlab_project_id, issue_iid_int, case_name, run_name, status_id
                    )
            except Exception as exc:
                stats["errors"] += 1
                yield {
                    "level": "error",
                    "caseName": case_name,
                    "issueIid": issue.get("iid"),
                    "error": SAFE_INTERNAL_ERROR,
                }
                logger.error('[StatusSync] Erreur #%s "%s": %s', issue.get("iid"), case_name, exc)

            await self._delay()

        yield {"level": "done", **stats}
        logger.info(
            "[StatusSync] Terminé — updated=%s skipped=%s errors=%s",
            stats["updated"],
            stats["skipped"],
            stats["errors"],
        )


status_sync_service = StatusSyncService()
