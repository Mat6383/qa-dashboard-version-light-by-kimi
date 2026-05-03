"""Outgoing webhook emitter with HMAC-SHA256 signatures."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhooks import WebhookSubscription
from app.utils.logger import get_logger

logger = get_logger(__name__)


class WebhookEmitter:
    """Emit webhooks to subscribed URLs with HMAC-SHA256 signatures."""

    async def emit(
        self,
        db: AsyncSession,
        event: str,
        payload: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Send payload to all enabled subscriptions matching the event."""
        result = await db.execute(select(WebhookSubscription).where(WebhookSubscription.enabled.is_(True)))
        subs = result.scalars().all()

        sent: list[dict[str, Any]] = []
        for sub in subs:
            if event not in sub.events:
                continue
            if sub.filters and not self._matches_filters(payload, sub.filters):
                continue
            status = await self._send(sub, event, payload)
            sent.append({"webhook_id": sub.id, "url": sub.url, "status": status})
        return sent

    async def _send(
        self,
        sub: WebhookSubscription,
        event: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        body = json.dumps({"event": event, "payload": payload, "timestamp": _utc_now()}, default=str)
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Webhook-Signature": _sign(body, sub.secret),
            "User-Agent": "QA-Dashboard-Webhook/1.0",
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(sub.url, content=body.encode("utf-8"), headers=headers)
                resp.raise_for_status()
            return {"success": True, "status_code": resp.status_code}
        except httpx.HTTPStatusError as exc:
            logger.warning("Webhook HTTP error %s → %s", sub.url, exc.response.status_code)
            return {"success": False, "status_code": exc.response.status_code, "error": str(exc)}
        except Exception as exc:
            logger.warning("Webhook failed %s → %s", sub.url, exc)
            return {"success": False, "error": str(exc)}

    def _matches_filters(self, payload: dict[str, Any], filters: dict[str, Any]) -> bool:
        for key, value in filters.items():
            if key not in payload or payload[key] != value:
                return False
        return True


webhook_emitter = WebhookEmitter()


def _sign(body: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


def _utc_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
