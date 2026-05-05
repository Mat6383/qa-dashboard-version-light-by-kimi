"""Multi-project mapping for Dashboard 6 — GitLab ↔ Testmo sync."""

from __future__ import annotations

from typing import Any

# Mirror of backend/config/projects.config.ts
SYNC_PROJECTS: list[dict[str, Any]] = [
    {
        "id": "neo-pilot",
        "label": "Neo-Pilot",
        "testmo": {
            "projectId": 1,
            "repoId": 1,
            "rootFolderId": 4514,
            "gitlabIntegrationId": 2,
            "gitlabConnectionProjectId": 63,
        },
        "gitlab": {
            "projectId": 63,
            "token": None,
            "label": "Test::TODO",
        },
        "configured": True,
    },
    {
        "id": "workshop-web",
        "label": "Workshop Web",
        "testmo": {
            "projectId": 10,
            "repoId": 101,
            "rootFolderId": 4522,
            "gitlabIntegrationId": 2,
            "gitlabConnectionProjectId": 141,
        },
        "gitlab": {
            "projectId": 141,
            "token": None,
            "label": "Test::TODO",
        },
        "configured": True,
    },
    {
        "id": "workshop",
        "label": "Workshop",
        "testmo": {
            "projectId": 3,
            "repoId": 5,
            "rootFolderId": None,
            "gitlabIntegrationId": 2,
            "gitlabConnectionProjectId": 61,
        },
        "gitlab": {
            "projectId": 61,
            "token": None,
            "label": "Test::TODO",
        },
        "configured": True,
    },
    {
        "id": "link",
        "label": "Link",
        "testmo": {
            "projectId": 7,
            "repoId": 39,
            "rootFolderId": 694,
            "gitlabIntegrationId": 2,
            "gitlabConnectionProjectId": 61,
        },
        "gitlab": {
            "projectId": 61,
            "token": None,
            "label": "Test::TODO",
        },
        "configured": True,
    },
    {
        "id": "kiosk",
        "label": "KIOSK",
        "testmo": {
            "projectId": 2,
            "repoId": 4,
            "rootFolderId": 15,
            "gitlabIntegrationId": 2,
            "gitlabConnectionProjectId": None,
        },
        "gitlab": {
            "projectId": None,
            "token": None,
            "label": "Test::TODO",
        },
        "configured": False,
    },
]


def get_sync_project(project_id: str | int) -> dict[str, Any] | None:
    """Return project config by logical id."""
    for p in SYNC_PROJECTS:
        if str(p["id"]) == str(project_id):
            return p
    return None


def resolve_gitlab_project_id(project_id: str | int) -> str | int | None:
    """Resolve a logical project id (e.g. 'neo-pilot') into a real GitLab project id."""
    project = get_sync_project(project_id)
    if project:
        return project["gitlab"].get("projectId")
    # Fallback: if project_id looks like a number, return it directly
    if isinstance(project_id, int):
        return project_id
    if isinstance(project_id, str) and project_id.isdigit():
        return int(project_id)
    return None


def resolve_testmo_project_id(project_id: str | int) -> int | None:
    """Resolve a logical project id into the configured Testmo project id."""
    project = get_sync_project(project_id)
    if project:
        return project["testmo"].get("projectId")
    return None


def resolve_testmo_repo_id(project_id: str | int) -> int | None:
    """Resolve a logical project id into the configured Testmo repo id."""
    project = get_sync_project(project_id)
    if project:
        return project["testmo"].get("repoId")
    return None


def resolve_gitlab_integration_info(project_id: str | int) -> dict[str, int | None]:
    """Resolve GitLab integration info for linking issues in Testmo cases.

    Returns {"integration_id": int | None, "connection_project_id": int | None}
    """
    project = get_sync_project(project_id)
    if not project:
        return {"integration_id": None, "connection_project_id": None}
    testmo = project.get("testmo", {})
    gitlab = project.get("gitlab", {})
    return {
        "integration_id": testmo.get("gitlabIntegrationId"),
        "connection_project_id": gitlab.get("projectId"),
    }
