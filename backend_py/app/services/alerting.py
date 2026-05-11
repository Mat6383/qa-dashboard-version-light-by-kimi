"""Active alerting — email (aiosmtplib), Slack & Teams (httpx)."""

from __future__ import annotations

import json
from typing import Any

import httpx
from aiosmtplib import SMTP

from app.config import settings
from app.utils.api_helpers import sanitize_errors
from app.utils.logger import get_logger

logger = get_logger(__name__)


class AlertingService:
    """Send alerts via email, Slack, or Teams."""

    def __init__(self) -> None:
        self._smtp: SMTP | None = None

    def _get_smtp_client(self) -> SMTP:
        if self._smtp is None:
            self._smtp = SMTP(
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                use_tls=settings.smtp_port == 465,
            )
        return self._smtp

    @sanitize_errors(logger, msg="Email send failed")
    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html: str | None = None,
    ) -> dict[str, Any]:
        if not settings.smtp_host or not settings.smtp_user or not settings.smtp_pass:
            return {"success": False, "error": "SMTP not configured"}

        message = f"""Subject: {subject}
From: {settings.smtp_from or settings.smtp_user}
To: {to}
Content-Type: text/html; charset=utf-8

{html or body}
"""
        smtp = self._get_smtp_client()
        if not smtp.is_connected:
            await smtp.connect()
            if settings.smtp_port == 587:
                await smtp.starttls()
            await smtp.login(settings.smtp_user, settings.smtp_pass)
        await smtp.sendmail(settings.smtp_from or settings.smtp_user, [to], message.encode("utf-8"))
        return {"success": True, "channel": "email", "destination": to}

    @sanitize_errors(logger, msg="Slack send failed")
    async def send_slack(
        self,
        webhook_url: str,
        message: str,
        template: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any]
        if template:
            try:
                payload = json.loads(template)
                payload["text"] = message
            except json.JSONDecodeError:
                payload = {"text": message}
        else:
            payload = {"text": message}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(webhook_url, json=payload)
            resp.raise_for_status()
        return {"success": True, "channel": "slack", "destination": webhook_url}

    @sanitize_errors(logger, msg="Teams send failed")
    async def send_teams(
        self,
        webhook_url: str,
        message: str,
        template: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any]
        if template:
            try:
                payload = json.loads(template)
            except json.JSONDecodeError:
                payload = {
                    "@type": "MessageCard",
                    "@context": "https://schema.org/extensions",
                    "text": message,
                }
        else:
            payload = {
                "@type": "MessageCard",
                "@context": "https://schema.org/extensions",
                "text": message,
            }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(webhook_url, json=payload)
            resp.raise_for_status()
        return {"success": True, "channel": "teams", "destination": webhook_url}

    async def send_test(
        self,
        channel: str,
        destination: str | None = None,
    ) -> dict[str, Any]:
        msg = f"🔔 Test alert from QA Dashboard — {channel} channel is working."
        if channel == "email" and destination:
            return await self.send_email(destination, "QA Dashboard Test Alert", msg, f"<p>{msg}</p>")
        if channel == "slack" and destination:
            return await self.send_slack(destination, msg)
        if channel == "teams" and destination:
            return await self.send_teams(destination, msg)
        return {"success": False, "error": "Invalid channel or missing destination"}


alerting_service = AlertingService()
