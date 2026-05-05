"""Tests for TestmoBrowserService with mocked Playwright."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.testmo_browser import TestmoBrowserService


@pytest.fixture
def mock_page():
    page = MagicMock()
    page.goto = AsyncMock(return_value=None)
    el = MagicMock(
        click=AsyncMock(),
        fill=AsyncMock(),
        select_option=AsyncMock(),
        scroll_into_view_if_needed=AsyncMock(),
    )
    page.wait_for_selector = AsyncMock(return_value=el)
    page.wait_for_navigation = AsyncMock(return_value=None)
    page.wait_for_load_state = AsyncMock(return_value=None)
    page.query_selector = AsyncMock(return_value=None)
    page.query_selector_all = AsyncMock(return_value=[])
    page.keyboard = MagicMock(press=AsyncMock())
    page.click = AsyncMock()
    page.fill = AsyncMock()
    page.screenshot = AsyncMock()
    page.close = AsyncMock()
    page.set_default_timeout = MagicMock()
    page.url = "https://testmo.example.com/projects/1/runs/456"
    page.context = MagicMock(add_cookies=AsyncMock())
    page.expect_navigation = MagicMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())
    page.eval_on_selector_all = AsyncMock(return_value=[])
    return page


@pytest.fixture
def mock_browser(mock_page):
    browser = MagicMock()
    browser.new_page = AsyncMock(return_value=mock_page)
    browser.close = AsyncMock()
    return browser


@pytest.fixture
def mock_playwright(mock_browser):
    pw = MagicMock()
    pw.chromium = MagicMock(launch=AsyncMock(return_value=mock_browser))
    pw.stop = AsyncMock()
    return pw


@pytest.fixture
def service(mock_playwright, mock_browser):
    svc = TestmoBrowserService()
    svc._playwright = mock_playwright
    svc._browser = mock_browser
    return svc


@pytest.mark.asyncio
class TestAuthenticate:
    async def test_cookie_auth(self, service, mock_page):
        with patch.dict("os.environ", {"TESTMO_BROWSER_COOKIE": "session_abc123", "TESTMO_URL": "https://testmo.example.com"}):
            mock_page.url = "https://testmo.example.com/projects"
            result = await service.authenticate(mock_page)
            assert result is mock_page
            mock_page.context.add_cookies.assert_called_once()

    async def test_already_authenticated(self, service, mock_page):
        with patch.dict("os.environ", {"TESTMO_URL": "https://testmo.example.com"}):
            mock_page.url = "https://testmo.example.com/projects"
            result = await service.authenticate(mock_page)
            assert result is mock_page
            mock_page.fill.assert_not_called()

    async def test_login_failure_no_creds(self, service, mock_page):
        with patch.dict("os.environ", {"TESTMO_URL": "https://testmo.example.com"}, clear=True):
            mock_page.url = "https://testmo.example.com/auth/login"
            with pytest.raises(RuntimeError, match="TESTMO_BROWSER_COOKIE"):
                await service.authenticate(mock_page)


@pytest.mark.asyncio
class TestCreateManualRun:
    async def test_create_run_success(self, service, mock_page):
        with patch("app.services.testmo_browser.settings.testmo_url", "https://testmo.example.com"):
            mock_page.url = "https://testmo.example.com/projects/1/runs/456"
            result = await service.create_manual_run(1, {"name": "R06 - run 1", "milestoneId": 9})
            assert result["runId"] == 456
            assert "/runs/456" in result["url"]
            mock_page.goto.assert_called_with("https://testmo.example.com/projects/1/runs", wait_until="networkidle", timeout=30000)

    async def test_create_run_missing_run_id(self, service, mock_page):
        with patch("app.services.testmo_browser.settings.testmo_url", "https://testmo.example.com"):
            mock_page.url = "https://testmo.example.com/projects/1/runs"
            mock_page.eval_on_selector_all = AsyncMock(return_value=[])
            with pytest.raises(RuntimeError, match="Could not extract runId"):
                await service.create_manual_run(1, {"name": "Test"})


@pytest.mark.asyncio
class TestAddRunResults:
    async def test_per_row_strategy(self, service, mock_page):
        with patch("app.services.testmo_browser.settings.testmo_url", "https://testmo.example.com"):
            mock_page.url = "https://testmo.example.com/projects/1/runs/123"
            with patch.object(service, "_set_single_result", new_callable=AsyncMock) as mock_single:
                stats = await service.add_run_results(1, 123, [
                    {"caseId": 1, "status": "passed"},
                    {"caseId": 2, "status": "failed", "note": "bug"},
                ])
                assert stats["updated"] == 2
                assert stats["errors"] == 0
                assert mock_single.call_count == 2


@pytest.mark.asyncio
class TestHealthCheck:
    async def test_ok(self, service, mock_page):
        with patch("app.services.testmo_browser.settings.testmo_url", "https://testmo.example.com"):
            mock_page.url = "https://testmo.example.com/projects"
            check = await service.health_check()
            assert check["ok"] is True

    async def test_ko(self, service, mock_page):
        with patch("app.services.testmo_browser.settings.testmo_url", ""):
            check = await service.health_check()
            assert check["ok"] is False
