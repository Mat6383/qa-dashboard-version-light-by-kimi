"""Testmo Browser Service — UI Automation with Playwright.

Creates and updates manual runs in Testmo via headless browser automation,
because the Testmo REST API is read-only for manual runs.
"""

from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright, Page

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ─── Selectors (tunable via env) ───────────────────────────────────────────

_SELECTORS = {
    "login_email": os.getenv(
        "TESTMO_SEL_LOGIN_EMAIL",
        'input[type="email"],input[name="email"],#email',
    ),
    "login_password": os.getenv(
        "TESTMO_SEL_LOGIN_PASSWORD",
        'input[type="password"],input[name="password"],#password',
    ),
    "login_submit": os.getenv(
        "TESTMO_SEL_LOGIN_SUBMIT",
        'button[type="submit"],button:has-text("Sign in"),button:has-text("Log in")',
    ),
    "add_run_button": os.getenv(
        "TESTMO_SEL_ADD_RUN",
        'a:has-text("Add Run"),button:has-text("Add Run"),[data-testid="run-add"],.run-add',
    ),
    "add_run_modal": os.getenv(
        "TESTMO_SEL_ADD_RUN_MODAL",
        ".modal,.dialog,[role=\"dialog\"],.run-add-dialog",
    ),
    "run_name_input": os.getenv(
        "TESTMO_SEL_RUN_NAME",
        'input[name="name"],input[placeholder*="name" i],#run-name',
    ),
    "run_milestone_select": os.getenv(
        "TESTMO_SEL_RUN_MILESTONE",
        'select[name="milestone_id"],[data-testid="milestone-select"]',
    ),
    "run_config_select": os.getenv(
        "TESTMO_SEL_RUN_CONFIG",
        'select[name="config_id"],[data-testid="config-select"]',
    ),
    "run_submit_button": os.getenv(
        "TESTMO_SEL_RUN_SUBMIT",
        'button:has-text("Add Run"):not([disabled]),button[type="submit"],.btn-primary:has-text("Add")',
    ),
    "select_cases_button": os.getenv(
        "TESTMO_SEL_SELECT_CASES",
        'button:has-text("Select Cases"),a:has-text("Select Cases"),[data-testid="select-cases"]',
    ),
    "case_checkbox": os.getenv(
        "TESTMO_SEL_CASE_CHECKBOX",
        'input[type="checkbox"],.case-checkbox,.select-row-checkbox',
    ),
    "case_select_confirm": os.getenv(
        "TESTMO_SEL_CASE_CONFIRM",
        'button:has-text("Select"),button:has-text("Confirm"),button:has-text("Add Selected")',
    ),
    "test_row": os.getenv(
        "TESTMO_SEL_TEST_ROW",
        ".test-row,.run-test,.case-row",
    ),
    "result_note_input": os.getenv(
        "TESTMO_SEL_RESULT_NOTE",
        'textarea[name="note"],.result-note,[data-testid="result-note"]',
    ),
    "result_submit": os.getenv(
        "TESTMO_SEL_RESULT_SUBMIT",
        'button:has-text("Save Result"),button:has-text("Submit"),button:has-text("Add Result")',
    ),
    "toast_success": os.getenv(
        "TESTMO_SEL_TOAST_SUCCESS",
        '.toast-success,.alert-success,[data-testid="toast-success"]',
    ),
    "loading_spinner": os.getenv(
        "TESTMO_SEL_LOADING",
        '.loading,.spinner,.busy,[data-testid="loading"]',
    ),
}

_TIMEOUT = int(os.getenv("TESTMO_BROWSER_TIMEOUT", "30000"))
_HEADLESS = os.getenv("TESTMO_BROWSER_HEADLESS", "true").lower() != "false"
_SCREENSHOT_DIR = Path(
    os.getenv("TESTMO_BROWSER_SCREENSHOTS", str(Path(__file__).resolve().parent.parent.parent / "logs" / "testmo-browser"))
)


def _ensure_screenshot_dir() -> None:
    _SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def _screenshot_path(name: str) -> Path:
    _ensure_screenshot_dir()
    ts = datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")
    return _SCREENSHOT_DIR / f"{name}-{ts}.png"


async def _screenshot(page: Page, name: str) -> None:
    try:
        p = _screenshot_path(name)
        await page.screenshot(path=str(p), full_page=True)
        logger.info("[TestmoBrowser] Screenshot: %s", p)
    except Exception as exc:
        logger.warning("[TestmoBrowser] Screenshot failed: %s", exc)


async def _safe_click(page: Page, selector: str, *, timeout: int | None = None, visible: bool = True) -> Any:
    sel = selector.split(",")[0].strip()
    el = await page.wait_for_selector(sel, timeout=timeout or _TIMEOUT, state="visible" if visible else None)
    if not el:
        raise RuntimeError(f"Element not found: {sel}")
    await el.scroll_into_view_if_needed()
    await el.click()
    return el


async def _safe_type(page: Page, selector: str, text: str) -> None:
    sel = selector.split(",")[0].strip()
    el = await page.wait_for_selector(sel, timeout=_TIMEOUT, state="visible")
    if not el:
        raise RuntimeError(f"Input not found: {sel}")
    await el.click()
    await page.keyboard.press("Control+a")
    await el.fill(text)


async def _safe_select(page: Page, selector: str, value: str | int) -> None:
    sel = selector.split(",")[0].strip()
    el = await page.wait_for_selector(sel, timeout=_TIMEOUT, state="visible")
    if not el:
        raise RuntimeError(f"Select not found: {sel}")
    await el.select_option(str(value))


async def _wait_for_network_idle(page: Page, timeout: int = _TIMEOUT) -> None:
    try:
        await page.wait_for_load_state("networkidle", timeout=timeout)
    except Exception:
        pass


async def _dismiss_modals(page: Page) -> None:
    try:
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.3)
    except Exception:
        pass


def _status_button_selector(status: str) -> str:
    # Playwright supports text selectors via :has-text in its own engine,
    # but to keep it simple we use the text= engine fallback in methods.
    return (
        f'button:has-text("{status}"),[data-status="{status.lower()}"],'
        f'.status-{status.lower()}'
    )


# ─── Service ───────────────────────────────────────────────────────────────


class TestmoBrowserService:
    def __init__(self) -> None:
        self._playwright: Any | None = None
        self._browser: Any | None = None

    async def _ensure_browser(self) -> None:
        if self._browser is None:
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=_HEADLESS,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    async def _new_page(self) -> Page:
        await self._ensure_browser()
        page = await self._browser.new_page(viewport={"width": 1920, "height": 1080})
        page.set_default_timeout(_TIMEOUT)
        return page

    # ── Auth ─────────────────────────────────────────────────────────────────

    async def authenticate(self, page: Page) -> Page:
        base_url = settings.testmo_url
        if not base_url:
            raise RuntimeError("TESTMO_URL manquant")

        cookie_value = os.getenv("TESTMO_BROWSER_COOKIE")
        if cookie_value:
            logger.info("[TestmoBrowser] Using provided session cookie")
            domain = base_url.replace("https://", "").replace("http://", "").split("/")[0]
            await page.context.add_cookies([
                {
                    "name": "testmo_session",
                    "value": cookie_value,
                    "domain": domain,
                    "path": "/",
                }
            ])

        await page.goto(f"{base_url}/projects", wait_until="networkidle", timeout=_TIMEOUT)
        await _wait_for_network_idle(page)
        await _screenshot(page, "01-projects-page")

        current_url = page.url
        is_logged_in = "/auth" not in current_url and "/login" not in current_url and "/signin" not in current_url

        if is_logged_in:
            logger.info("[TestmoBrowser] Already authenticated")
            return page

        email = os.getenv("TESTMO_UI_USER") or os.getenv("TESTMO_EMAIL")
        password = os.getenv("TESTMO_UI_PASSWORD") or os.getenv("TESTMO_PASSWORD")

        if not email or not password:
            raise RuntimeError(
                "Testmo UI authentication failed. Provide TESTMO_BROWSER_COOKIE "
                "or TESTMO_UI_USER + TESTMO_UI_PASSWORD"
            )

        logger.info("[TestmoBrowser] Logging in via form")
        await _safe_type(page, _SELECTORS["login_email"], email)
        await _safe_type(page, _SELECTORS["login_password"], password)
        await _screenshot(page, "02-login-filled")

        try:
            async with page.expect_navigation(wait_until="networkidle", timeout=_TIMEOUT):
                await _safe_click(page, _SELECTORS["login_submit"])
        except Exception:
            pass

        await _wait_for_network_idle(page)
        await _screenshot(page, "03-post-login")

        post_url = page.url
        if "/auth" in post_url or "/login" in post_url:
            raise RuntimeError("Testmo login failed — still on auth page")

        logger.info("[TestmoBrowser] Authenticated successfully")
        return page

    # ── Create Manual Run ────────────────────────────────────────────────────

    async def create_manual_run(
        self,
        project_id: int,
        options: dict[str, Any],
    ) -> dict[str, Any]:
        page = await self._new_page()
        base_url = settings.testmo_url
        name = str(options.get("name", ""))
        milestone_id = options.get("milestoneId")
        config_id = options.get("configId")
        case_ids = options.get("caseIds")

        try:
            await self.authenticate(page)

            runs_url = f"{base_url}/projects/{project_id}/runs"
            logger.info("[TestmoBrowser] Navigating to %s", runs_url)
            await page.goto(runs_url, wait_until="networkidle", timeout=_TIMEOUT)
            await _wait_for_network_idle(page)
            await _screenshot(page, "04-runs-list")

            logger.info("[TestmoBrowser] Clicking Add Run")
            await _safe_click(page, _SELECTORS["add_run_button"])
            await asyncio.sleep(0.8)
            await _screenshot(page, "05-add-run-modal")

            modal = await page.wait_for_selector(
                _SELECTORS["add_run_modal"], timeout=_TIMEOUT, state="visible"
            )
            if not modal:
                raise RuntimeError("Add Run modal did not open")

            logger.info('[TestmoBrowser] Filling run name: "%s"', name)
            await _safe_type(page, _SELECTORS["run_name_input"], name)

            if milestone_id:
                logger.info("[TestmoBrowser] Selecting milestone: %s", milestone_id)
                try:
                    await _safe_select(page, _SELECTORS["run_milestone_select"], milestone_id)
                except Exception as exc:
                    logger.warning("[TestmoBrowser] Could not select milestone: %s", exc)

            if config_id:
                logger.info("[TestmoBrowser] Selecting config: %s", config_id)
                try:
                    await _safe_select(page, _SELECTORS["run_config_select"], config_id)
                except Exception as exc:
                    logger.warning("[TestmoBrowser] Could not select config: %s", exc)

            await _screenshot(page, "06-form-filled")

            if case_ids and len(case_ids) > 0:
                logger.info("[TestmoBrowser] Selecting %s cases", len(case_ids))
                try:
                    await _safe_click(page, _SELECTORS["select_cases_button"])
                    await asyncio.sleep(1.0)
                    await _screenshot(page, "07-case-selection")

                    for case_id in case_ids:
                        try:
                            row_sel = (
                                f'[data-case-id="{case_id}"],'
                                f'tr:has-text("C{case_id}"),tr:has-text("{case_id}")'
                            )
                            row = await page.wait_for_selector(row_sel, timeout=5000, state="visible")
                            if row:
                                cb = await row.query_selector(_SELECTORS["case_checkbox"])
                                if cb:
                                    await cb.click()
                                    await asyncio.sleep(0.2)
                        except Exception as exc:
                            logger.warning("[TestmoBrowser] Could not select case %s: %s", case_id, exc)

                    await _screenshot(page, "08-cases-selected")
                    await _safe_click(page, _SELECTORS["case_select_confirm"])
                    await asyncio.sleep(0.8)
                except Exception as exc:
                    logger.warning("[TestmoBrowser] Case selection failed: %s", exc)

            logger.info("[TestmoBrowser] Submitting run")
            await _screenshot(page, "09-pre-submit")
            await _safe_click(page, _SELECTORS["run_submit_button"])

            try:
                await asyncio.wait_for(
                    asyncio.gather(
                        page.wait_for_navigation(wait_until="networkidle", timeout=_TIMEOUT),
                        page.wait_for_selector(_SELECTORS["toast_success"], timeout=_TIMEOUT),
                        return_exceptions=True,
                    ),
                    timeout=_TIMEOUT / 1000,
                )
            except asyncio.TimeoutError:
                pass

            await _wait_for_network_idle(page)
            await _screenshot(page, "10-post-submit")

            final_url = page.url
            run_id_match = re.search(r"/runs/(\d+)", final_url)
            run_id = int(run_id_match.group(1)) if run_id_match else 0

            if not run_id:
                links = await page.eval_on_selector_all(
                    'a[href*="/runs/"]',
                    "elements => elements.map(e => e.href)"
                )
                fresh_link = next((h for h in links if "/runs/" in h), None)
                if fresh_link:
                    m = re.search(r"/runs/(\d+)", fresh_link)
                    if m:
                        run_id = int(m.group(1))
                        return {"runId": run_id, "url": fresh_link}
                raise RuntimeError(f"Could not extract runId from URL: {final_url}")

            url = f"{base_url}/projects/{project_id}/runs/{run_id}"
            logger.info("[TestmoBrowser] Manual run created: %s", url)
            return {"runId": run_id, "url": url}
        finally:
            await page.close()

    # ── Add Results to Manual Run ────────────────────────────────────────────

    async def add_run_results(
        self,
        project_id: int,
        run_id: int,
        results: list[dict[str, Any]],
    ) -> dict[str, int]:
        page = await self._new_page()
        base_url = settings.testmo_url
        updated = 0
        errors = 0

        try:
            await self.authenticate(page)

            run_url = f"{base_url}/projects/{project_id}/runs/{run_id}"
            logger.info("[TestmoBrowser] Opening run %s", run_url)
            await page.goto(run_url, wait_until="networkidle", timeout=_TIMEOUT)
            await _wait_for_network_idle(page)
            await _screenshot(page, "11-run-detail")

            bulk_el = await page.query_selector(
                ".bulk-edit,.bulk-actions,[data-testid=\"bulk-edit\"],.select-all"
            )
            has_bulk = bulk_el is not None

            if has_bulk and len(results) > 3:
                logger.info("[TestmoBrowser] Using bulk-edit strategy")
                by_status: dict[str, list[dict[str, Any]]] = {}
                for r in results:
                    by_status.setdefault(r["status"], []).append(r)

                for status, items in by_status.items():
                    try:
                        await self._bulk_set_status(page, items, status)
                        updated += len(items)
                    except Exception as exc:
                        logger.error("[TestmoBrowser] Bulk status %s failed: %s", status, exc)
                        errors += len(items)
            else:
                logger.info("[TestmoBrowser] Using per-row strategy")
                for r in results:
                    try:
                        await self._set_single_result(page, r)
                        updated += 1
                    except Exception as exc:
                        logger.warning(
                            "[TestmoBrowser] Result update failed for case %s: %s",
                            r.get("caseId"), exc
                        )
                        errors += 1

            await _screenshot(page, "12-results-done")
            return {"updated": updated, "errors": errors}
        finally:
            await page.close()

    async def _bulk_set_status(self, page: Page, items: list[dict[str, Any]], status: str) -> None:
        for item in items[:20]:
            identifier = item.get("caseId") or item.get("testId")
            if not identifier:
                continue
            try:
                row_sel = (
                    f'tr:has-text("C{identifier}"),tr:has-text("{identifier}"),'
                    f'[data-test-id="{identifier}"]'
                )
                row = await page.wait_for_selector(row_sel, timeout=5000, state="visible")
                if row:
                    cb = await row.query_selector('input[type="checkbox"],.row-checkbox')
                    if cb:
                        await cb.click()
            except Exception:
                pass

        bulk_btn = await page.query_selector(
            ".bulk-edit button,.bulk-actions button,[data-testid=\"bulk-status\"]"
        )
        if not bulk_btn:
            raise RuntimeError("Bulk edit button not found")
        await bulk_btn.click()
        await asyncio.sleep(0.4)

        status_sel = _status_button_selector(status)
        status_btn = await page.query_selector(status_sel)
        if status_btn:
            await status_btn.click()
            await asyncio.sleep(0.6)
            await _wait_for_network_idle(page)
        else:
            # Fallback: search by text among visible buttons
            buttons = await page.query_selector_all("button, .status-btn, [role=\"button\"]")
            for btn in buttons:
                text = await btn.text_content()
                if text and status.lower() in text.lower():
                    await btn.click()
                    await asyncio.sleep(0.6)
                    await _wait_for_network_idle(page)
                    return
            raise RuntimeError(f'Status button for "{status}" not found')

    async def _set_single_result(self, page: Page, item: dict[str, Any]) -> None:
        identifier = item.get("caseId") or item.get("testId")
        if not identifier:
            raise RuntimeError("No caseId or testId provided")
        row_sel = (
            f'tr:has-text("C{identifier}"),tr:has-text("{identifier}"),'
            f'[data-test-id="{identifier}"]'
        )
        row = await page.wait_for_selector(row_sel, timeout=8000, state="visible")
        if not row:
            raise RuntimeError(f"Row not found for {identifier}")

        status_cell = await row.query_selector(
            'td:last-child,td.status,.status-cell,button:has-text("Untested")'
        )
        if status_cell:
            await status_cell.click()
        await asyncio.sleep(0.4)

        status = item.get("status", "")
        status_sel = _status_button_selector(status)
        target_btn = await page.query_selector(status_sel)
        if target_btn:
            await target_btn.click()
        else:
            buttons = await page.query_selector_all("button, .status-btn, [role=\"button\"]")
            for btn in buttons:
                text = await btn.text_content()
                if text and status.lower() in text.lower():
                    await btn.click()
                    break

        await asyncio.sleep(0.3)

        if item.get("note"):
            try:
                note_input = await page.wait_for_selector(
                    _SELECTORS["result_note_input"], timeout=3000, state="visible"
                )
                if note_input:
                    await note_input.fill(item["note"])
                    await asyncio.sleep(0.2)
            except Exception:
                pass

        try:
            save_btn = await page.wait_for_selector(
                _SELECTORS["result_submit"], timeout=5000, state="visible"
            )
            if save_btn:
                await save_btn.click()
        except Exception:
            pass

        await asyncio.sleep(0.4)
        await _wait_for_network_idle(page)

    # ── Health check ─────────────────────────────────────────────────────────

    async def health_check(self) -> dict[str, Any]:
        page = await self._new_page()
        try:
            await self.authenticate(page)
            return {"ok": True, "message": "Authenticated successfully"}
        except Exception as exc:
            return {"ok": False, "message": str(exc)}
        finally:
            await page.close()


testmo_browser_service = TestmoBrowserService()
