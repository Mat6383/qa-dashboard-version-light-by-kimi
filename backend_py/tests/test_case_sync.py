"""Tests for case sync orchestration (P31#3)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.case_sync import (
    CaseSyncService,
    build_case_payload,
    is_case_enriched,
    _is_case_identical,
    _parse_folder_hierarchy,
    extract_image_urls,
    replace_image_urls_in_html,
    _extract_text_from_html,
    _normalize_attachment_url,
)


# ------------------------------------------------------------------
# Helpers / fixtures
# ------------------------------------------------------------------


@pytest.fixture
def svc() -> CaseSyncService:
    return CaseSyncService()


# ------------------------------------------------------------------
# is_case_enriched
# ------------------------------------------------------------------


def test_is_case_enriched_estimate() -> None:
    assert is_case_enriched({"estimate": 3600}) is True


def test_is_case_enriched_issues() -> None:
    assert is_case_enriched({"issues": [{"id": 1}]}) is True


def test_is_case_enriched_manual_tags() -> None:
    assert is_case_enriched({"tags": ["critical", "gitlab-123-1"]}) is True
    assert is_case_enriched({"tags": ["gitlab-123-1"]}) is False


def test_is_case_enriched_custom_priority() -> None:
    assert is_case_enriched({"custom_priority": "High"}) is True
    assert is_case_enriched({"custom_priority": "Normal"}) is False
    assert is_case_enriched({}) is False


def test_is_case_enriched_custom_steps() -> None:
    assert is_case_enriched({"custom_steps": [{"text1": "<p>Step</p>"}]}) is True
    assert is_case_enriched({"custom_steps": [{"text1": ""}]}) is False
    assert is_case_enriched({"custom_steps": []}) is False


# ------------------------------------------------------------------
# _is_case_identical
# ------------------------------------------------------------------


def test_is_case_identical_force_update_when_images_missing_attachments() -> None:
    existing = {"name": "T", "custom_description": "<p>foo</p>", "attachments": []}
    payload = {"name": "T", "custom_description": "<p>foo <img src='/a.png'></p>"}
    assert _is_case_identical(existing, payload) is False


def test_is_case_identical_skips_when_images_already_uploaded() -> None:
    existing = {"name": "T", "custom_description": "<p>foo</p>", "attachments": [{"id": 1}]}
    payload = {"name": "T", "custom_description": "<p>foo <img src='/a.png'></p>"}
    assert _is_case_identical(existing, payload) is True


# ------------------------------------------------------------------
# build_case_payload
# ------------------------------------------------------------------


def test_build_case_payload_basic() -> None:
    issue = {
        "title": "Fix login bug",
        "iid": 42,
        "description": "Login fails",
        "time_estimate": 3600,
    }
    payload = build_case_payload(issue, [], 5, 123, "R06")
    assert payload["name"] == "Fix login bug"
    assert payload["folder_id"] == 5
    assert payload["estimate"] == 3600
    assert "gitlab-123-42" in payload["tags"]
    assert "iteration-R06" in payload["tags"]


def test_build_case_payload_with_steps() -> None:
    issue = {"title": "T", "iid": 1}
    notes = [{"body": "[TEST]\nStep 1."}]
    payload = build_case_payload(issue, notes, 1, 1, "Iter")
    assert "custom_steps" in payload
    assert len(payload["custom_steps"]) == 1
    assert payload["custom_steps"][0]["display_order"] == 1


def test_build_case_payload_truncates_description() -> None:
    import markdown

    issue = {"title": "T", "iid": 1, "description": "x" * 3000}
    payload = build_case_payload(issue, [], 1, 1, "Iter")
    assert "…" in payload["custom_description"]
    expected = markdown.markdown("x" * 2000 + "…")
    assert payload["custom_description"] == expected


# ------------------------------------------------------------------
# Image helpers
# ------------------------------------------------------------------


def test_normalize_attachment_url_fixes_localhost() -> None:
    from app.config import settings

    assert (
        _normalize_attachment_url("/attachments/view/10")
        == f"{settings.testmo_url.rstrip('/')}/attachments/view/10"
    )
    assert (
        _normalize_attachment_url("http://localhost/attachments/view/10")
        == f"{settings.testmo_url.rstrip('/')}/attachments/view/10"
    )
    assert (
        _normalize_attachment_url("https://testmo.com/attachments/view/10")
        == "https://testmo.com/attachments/view/10"
    )


def test_extract_image_urls_finds_markdown_images() -> None:
    md = "![alt1](/uploads/a.png) some text ![alt2](https://gitlab.com/b.jpg)"
    assert extract_image_urls(md) == ["/uploads/a.png", "https://gitlab.com/b.jpg"]


def test_extract_image_urls_empty() -> None:
    assert extract_image_urls("no images here") == []


def test_replace_image_urls_in_html() -> None:
    html = '<p><img src="/uploads/a.png" alt="x"></p>'
    result = replace_image_urls_in_html(html, {"/uploads/a.png": "https://testmo.com/att/1"})
    assert result == '<p><img src="https://testmo.com/att/1" alt="x"></p>'


def test_extract_text_from_html() -> None:
    assert _extract_text_from_html("<p>foo <img src='/a.png'> bar</p>") == "foo bar"


# ------------------------------------------------------------------
# _parse_folder_hierarchy
# ------------------------------------------------------------------


def test_parse_folder_hierarchy_with_dash() -> None:
    assert _parse_folder_hierarchy("R06 - run 1") == ("R06", "R06 - run 1")


def test_parse_folder_hierarchy_without_dash() -> None:
    assert _parse_folder_hierarchy("Sprint 42") == (None, "Sprint 42")


# ------------------------------------------------------------------
# sync_iteration — error paths
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sync_iteration_not_found(svc: CaseSyncService) -> None:
    with patch(
        "app.services.case_sync.gitlab_service.find_iteration_for_project",
        new=AsyncMock(return_value=None),
    ):
        result = await svc.sync_iteration(1, 1, "Missing")
    assert result.errors == 1
    assert "not found" in result.details[0]["error"]


@pytest.mark.asyncio
async def test_sync_iteration_no_issues(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06"}
        mock_issues.return_value = []
        result = await svc.sync_iteration(1, 1, "R06")
    assert result.created == 0
    assert result.updated == 0
    assert result.skipped == 0
    assert result.errors == 0


@pytest.mark.asyncio
async def test_sync_iteration_folder_error(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06"}
        mock_issues.return_value = [{"iid": 1, "title": "Bug"}]
        mock_folder.side_effect = Exception("API down")
        result = await svc.sync_iteration(1, 1, "R06")
    assert result.errors == 1
    assert "Folder setup failed" in result.details[0]["error"]


@pytest.mark.asyncio
async def test_sync_iteration_cases_fetch_error(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
        patch(
            "app.services.case_sync.testmo_service.get_cases", new_callable=AsyncMock
        ) as mock_cases,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06"}
        mock_issues.return_value = [{"iid": 1, "title": "Bug"}]
        mock_folder.return_value = {"id": 99}
        mock_cases.side_effect = Exception("timeout")
        result = await svc.sync_iteration(1, 1, "R06")
    assert result.errors == 1
    assert "Failed to fetch cases" in result.details[0]["error"]


# ------------------------------------------------------------------
# sync_iteration — happy paths
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sync_iteration_creates_new_case(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.gitlab_service.get_issue_notes", new_callable=AsyncMock
        ) as mock_notes,
        patch(
            "app.services.case_sync.gitlab_service.update_issue_label", new_callable=AsyncMock
        ) as _mock_label,
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
        patch(
            "app.services.case_sync.testmo_service.get_cases", new_callable=AsyncMock
        ) as mock_cases,
        patch(
            "app.services.case_sync.testmo_service.create_cases", new_callable=AsyncMock
        ) as mock_create,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06 - run 1"}
        mock_issues.return_value = [{"iid": 1, "title": "New case"}]
        mock_notes.return_value = []
        mock_folder.return_value = {"id": 99}
        mock_cases.return_value = []
        mock_create.return_value = [{"id": 100}]

        result = await svc.sync_iteration(1, 1, "R06 - run 1")

    assert result.created == 1
    assert result.updated == 0
    assert result.skipped == 0
    assert result.errors == 0
    assert result.details[0]["action"] == "created"
    assert result.details[0]["case_id"] == 100
    mock_create.assert_called_once()
    _mock_label.assert_called_once_with(1, 1, add_labels=["Sync-Updated"], remove_labels=[])


@pytest.mark.asyncio
async def test_sync_iteration_updates_existing_case(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.gitlab_service.get_issue_notes", new_callable=AsyncMock
        ) as mock_notes,
        patch(
            "app.services.case_sync.gitlab_service.update_issue_label", new_callable=AsyncMock
        ) as _mock_label,
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
        patch(
            "app.services.case_sync.testmo_service.get_cases", new_callable=AsyncMock
        ) as mock_cases,
        patch(
            "app.services.case_sync.testmo_service.update_case", new_callable=AsyncMock
        ) as mock_update,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06"}
        mock_issues.return_value = [{"iid": 1, "title": "Existing case"}]
        mock_notes.return_value = []
        mock_folder.return_value = {"id": 99}
        mock_cases.return_value = [
            {"id": 50, "name": "Existing case", "custom_description": "Old description"}
        ]
        mock_update.return_value = {"updated": True}

        result = await svc.sync_iteration(1, 1, "R06")

    assert result.created == 0
    assert result.updated == 1
    assert result.details[0]["action"] == "updated"
    assert result.details[0]["case_id"] == 50
    mock_update.assert_called_once()


@pytest.mark.asyncio
async def test_sync_iteration_skips_enriched(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
        patch(
            "app.services.case_sync.testmo_service.get_cases", new_callable=AsyncMock
        ) as mock_cases,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06"}
        mock_issues.return_value = [{"iid": 1, "title": "Rich case"}]
        mock_folder.return_value = {"id": 99}
        mock_cases.return_value = [
            {"id": 50, "name": "Rich case", "estimate": 3600, "issues": [{"display_id": "1"}]}
        ]

        result = await svc.sync_iteration(1, 1, "R06")

    assert result.skipped == 1
    assert result.created == 0
    assert result.updated == 0
    assert result.details[0]["reason"] == "enriched"


@pytest.mark.asyncio
async def test_sync_iteration_dry_run(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.gitlab_service.get_issue_notes", new_callable=AsyncMock
        ) as mock_notes,
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
        patch(
            "app.services.case_sync.testmo_service._find_folder_by_name", new_callable=AsyncMock
        ) as mock_find_folder,
        patch(
            "app.services.case_sync.testmo_service.get_cases", new_callable=AsyncMock
        ) as mock_cases,
        patch("app.services.case_sync.testmo_service.create_cases") as mock_create,
        patch("app.services.case_sync.testmo_service.update_case") as mock_update,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06"}
        mock_issues.return_value = [
            {"iid": 1, "title": "New"},
            {"iid": 2, "title": "Old"},
        ]
        mock_notes.return_value = []
        mock_folder.return_value = {"id": 99}
        mock_find_folder.return_value = {"id": 99}
        mock_cases.return_value = [
            {"id": 50, "name": "Old", "custom_description": "Old description"}
        ]

        result = await svc.preview_sync_iteration(1, 1, "R06")

    assert result.created == 1
    assert result.updated == 1
    assert result.skipped == 0
    mock_create.assert_not_called()
    mock_update.assert_not_called()


@pytest.mark.asyncio
async def test_sync_iteration_notes_fetch_failure_continues(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.gitlab_service.get_issue_notes", new_callable=AsyncMock
        ) as mock_notes,
        patch("app.services.case_sync.gitlab_service.update_issue_label", new_callable=AsyncMock),
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
        patch(
            "app.services.case_sync.testmo_service.get_cases", new_callable=AsyncMock
        ) as mock_cases,
        patch(
            "app.services.case_sync.testmo_service.create_cases", new_callable=AsyncMock
        ) as mock_create,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06"}
        mock_issues.return_value = [{"iid": 1, "title": "Case"}]
        mock_notes.side_effect = Exception("403")
        mock_folder.return_value = {"id": 99}
        mock_cases.return_value = []
        mock_create.return_value = [{"id": 100}]

        result = await svc.sync_iteration(1, 1, "R06")

    assert result.created == 1
    assert result.errors == 0


@pytest.mark.asyncio
async def test_sync_iteration_folder_hierarchy(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.gitlab_service.get_issue_notes", new_callable=AsyncMock
        ) as mock_notes,
        patch("app.services.case_sync.gitlab_service.update_issue_label", new_callable=AsyncMock),
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
        patch(
            "app.services.case_sync.testmo_service.get_cases", new_callable=AsyncMock
        ) as mock_cases,
        patch(
            "app.services.case_sync.testmo_service.create_cases", new_callable=AsyncMock
        ) as mock_create,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06 - run 1"}
        mock_issues.return_value = [{"iid": 1, "title": "Case"}]
        mock_notes.return_value = []
        mock_folder.side_effect = [
            {"id": 10, "name": "R06"},
            {"id": 11, "name": "R06 - run 1"},
        ]
        mock_cases.return_value = []
        mock_create.return_value = [{"id": 100}]

        result = await svc.sync_iteration(1, 1, "R06 - run 1", root_folder_id=99)

    assert result.created == 1
    calls = mock_folder.call_args_list
    assert calls[0].kwargs["parent_id"] == 99
    assert calls[0].args[1] == "R06"
    assert calls[1].kwargs["parent_id"] == 10
    assert calls[1].args[1] == "R06 - run 1"


@pytest.mark.asyncio
async def test_sync_iteration_to_dict(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
        patch(
            "app.services.case_sync.testmo_service.get_cases", new_callable=AsyncMock
        ) as mock_cases,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06"}
        mock_issues.return_value = []
        mock_folder.return_value = {"id": 99}
        mock_cases.return_value = []
        result = await svc.sync_iteration(1, 1, "R06")
        d = result.to_dict()
    assert d == {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "folder_id": None,
        "folder_name": None,
        "details": [],
    }


@pytest.mark.asyncio
async def test_sync_iteration_prefetches_notes_in_parallel(svc: CaseSyncService) -> None:
    with (
        patch(
            "app.services.case_sync.gitlab_service.find_iteration_for_project",
            new_callable=AsyncMock,
        ) as mock_iter,
        patch(
            "app.services.case_sync.gitlab_service.get_issues_by_label_and_iteration",
            new_callable=AsyncMock,
        ) as mock_issues,
        patch(
            "app.services.case_sync.gitlab_service.get_issue_notes", new_callable=AsyncMock
        ) as mock_notes,
        patch("app.services.case_sync.gitlab_service.update_issue_label", new_callable=AsyncMock),
        patch(
            "app.services.case_sync.testmo_service.get_or_create_folder", new_callable=AsyncMock
        ) as mock_folder,
        patch(
            "app.services.case_sync.testmo_service.get_cases", new_callable=AsyncMock
        ) as mock_cases,
        patch(
            "app.services.case_sync.testmo_service.create_cases", new_callable=AsyncMock
        ) as mock_create,
    ):
        mock_iter.return_value = {"id": 10, "title": "R06"}
        mock_issues.return_value = [
            {"iid": 1, "title": "A"},
            {"iid": 2, "title": "B"},
            {"iid": 3, "title": "C"},
        ]
        mock_notes.return_value = []
        mock_folder.return_value = {"id": 99}
        mock_cases.return_value = []
        mock_create.return_value = [{"id": 100}, {"id": 101}, {"id": 102}]

        result = await svc.sync_iteration(1, 1, "R06")

    assert result.created == 3
    assert mock_notes.call_count == 3
    assert mock_notes.call_args_list == [
        ((1, 1),),
        ((1, 2),),
        ((1, 3),),
    ]
