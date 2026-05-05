"""Tests for Testmo case & folder repository methods."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.testmo import TestmoService


@pytest.fixture
def svc() -> TestmoService:
    service = TestmoService()
    service.cache.clear()
    return service


# ------------------------------------------------------------------
# get_cases
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_cases_single_page(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {
            "result": [{"id": 1, "name": "Case A"}, {"id": 2, "name": "Case B"}],
            "next_page": None,
        }
        cases = await svc.get_cases(project_id=1)
        assert len(cases) == 2
        assert cases[0]["name"] == "Case A"
        mock_get.assert_called_once_with("/projects/1/cases", {"per_page": 100, "page": 1, "expands": "tags"})


@pytest.mark.asyncio
async def test_get_cases_pagination(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = [
            {"result": [{"id": 1}], "next_page": 2},
            {"result": [{"id": 2}], "next_page": None},
        ]
        cases = await svc.get_cases(project_id=1)
        assert len(cases) == 2
        assert mock_get.call_count == 2


@pytest.mark.asyncio
async def test_get_cases_empty(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"result": [], "next_page": None}
        cases = await svc.get_cases(project_id=1)
        assert cases == []


@pytest.mark.asyncio
async def test_get_cases_with_folder_id(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"result": [{"id": 1}], "next_page": None}
        cases = await svc.get_cases(project_id=1, folder_id=42)
        assert len(cases) == 1
        mock_get.assert_called_once_with(
            "/projects/1/cases", {"per_page": 100, "page": 1, "folder_id": 42, "expands": "tags"}
        )


# ------------------------------------------------------------------
# find_case_by_name
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_find_case_by_name_found(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"result": [{"id": 1, "name": "Target"}, {"id": 2, "name": "Other"}]}
        case = await svc.find_case_by_name(1, "Target")
        assert case is not None
        assert case["id"] == 1


@pytest.mark.asyncio
async def test_find_case_by_name_not_found(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"result": [{"id": 1, "name": "Other"}]}
        case = await svc.find_case_by_name(1, "Missing")
        assert case is None


# ------------------------------------------------------------------
# create_cases
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_cases_single(svc: TestmoService) -> None:
    with patch.object(svc, "_post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {"result": [{"id": 10, "name": "New Case"}]}
        created = await svc.create_cases(1, [{"name": "New Case", "folder_id": 5}])
        assert len(created) == 1
        assert created[0]["id"] == 10
        mock_post.assert_called_once_with("/projects/1/cases", {"cases": [{"name": "New Case", "folder_id": 5}]})


@pytest.mark.asyncio
async def test_create_cases_multiple(svc: TestmoService) -> None:
    with patch.object(svc, "_post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {"result": [{"id": 1}, {"id": 2}]}
        created = await svc.create_cases(1, [{"name": "A"}, {"name": "B"}])
        assert len(created) == 2


@pytest.mark.asyncio
async def test_create_cases_empty(svc: TestmoService) -> None:
    with patch.object(svc, "_post", new_callable=AsyncMock) as mock_post:
        created = await svc.create_cases(1, [])
        assert created == []
        mock_post.assert_not_called()


# ------------------------------------------------------------------
# update_case
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_case(svc: TestmoService) -> None:
    with patch.object(svc, "_patch", new_callable=AsyncMock) as mock_patch:
        mock_patch.return_value = {"updated": True}
        result = await svc.update_case(1, 99, {"name": "Updated", "estimate": 3600})
        assert result == {"updated": True}
        mock_patch.assert_called_once_with(
            "/projects/1/cases", {"name": "Updated", "estimate": 3600, "ids": [99]}
        )


# ------------------------------------------------------------------
# get_folders
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_folders_root(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"result": [{"id": 1, "name": "Root"}]}
        folders = await svc.get_folders(1)
        assert len(folders) == 1
        mock_get.assert_called_once_with("/projects/1/folders", {"per_page": 100})


@pytest.mark.asyncio
async def test_get_folders_with_parent(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"result": [{"id": 2, "name": "Child"}]}
        folders = await svc.get_folders(1, parent_id=1)
        mock_get.assert_called_once_with("/projects/1/folders", {"per_page": 100, "parent_id": 1})


# ------------------------------------------------------------------
# create_folder
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_folder_root(svc: TestmoService) -> None:
    with patch.object(svc, "_post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {"result": [{"id": 5, "name": "R06"}]}
        folder = await svc.create_folder(1, "R06")
        assert folder["id"] == 5
        mock_post.assert_called_once_with("/projects/1/folders", {"folders": [{"name": "R06"}]})


@pytest.mark.asyncio
async def test_create_folder_with_parent(svc: TestmoService) -> None:
    with patch.object(svc, "_post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {"result": [{"id": 6, "name": "R06 - run 1"}]}
        folder = await svc.create_folder(1, "R06 - run 1", parent_id=5)
        assert folder["id"] == 6
        mock_post.assert_called_once_with(
            "/projects/1/folders", {"folders": [{"name": "R06 - run 1", "parent_id": 5}]}
        )


# ------------------------------------------------------------------
# get_or_create_folder
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_or_create_folder_existing(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"result": [{"id": 7, "name": "Existing"}]}
        folder = await svc.get_or_create_folder(1, "Existing")
        assert folder["id"] == 7


@pytest.mark.asyncio
async def test_get_or_create_folder_new(svc: TestmoService) -> None:
    with patch.object(svc, "_get", new_callable=AsyncMock) as mock_get, \
         patch.object(svc, "_post", new_callable=AsyncMock) as mock_post:
        mock_get.return_value = {"result": []}
        mock_post.return_value = {"result": [{"id": 8, "name": "New Folder"}]}
        folder = await svc.get_or_create_folder(1, "New Folder")
        assert folder["id"] == 8
        mock_post.assert_called_once()
