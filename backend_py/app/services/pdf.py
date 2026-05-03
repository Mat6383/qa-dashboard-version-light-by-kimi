"""PDF generation with Playwright page pool."""

from __future__ import annotations

import asyncio
from typing import Any

from playwright.async_api import async_playwright

from app.config import settings


class PdfService:
    def __init__(self) -> None:
        self._pool_size = settings.pdf_pool_size
        self._max_generations = settings.pdf_max_page_generations
        self._semaphore = asyncio.Semaphore(settings.pdf_max_concurrency)
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=settings.pdf_max_queue_size)
        self._pages: list[Any] = []
        self._playwright: Any | None = None
        self._browser: Any | None = None

    async def _ensure_browser(self) -> None:
        if self._browser is None:
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(headless=True)

    async def generate_dashboard_pdf(self, payload: dict[str, Any]) -> bytes:
        await self._ensure_browser()
        async with self._semaphore:
            page = await self._browser.new_page()
            try:
                html = payload.get("html", "<html><body>No content</body></html>")
                await page.set_content(html, wait_until="networkidle")
                pdf_bytes = await page.pdf(
                    format="A4",
                    print_background=True,
                    margin={"top": "20px", "bottom": "20px", "left": "20px", "right": "20px"},
                )
                return pdf_bytes
            finally:
                await page.close()

    async def shutdown(self) -> None:
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()


pdf_service = PdfService()
