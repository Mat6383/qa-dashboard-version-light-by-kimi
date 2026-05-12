from typing import Any

from sqlalchemy import select

from app.models.webhooks import WebhookSubscription

from app.routers.trpc._common import _err, _result


async def _webhooks_list(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    result = await db.execute(select(WebhookSubscription))
    rows = result.scalars().all()
    return _result(
        [
            {"id": r.id, "url": r.url, "events": r.events, "secret": r.secret, "enabled": r.enabled}
            for r in rows
        ]
    )


async def _webhooks_create(input_data: dict[str, Any], db) -> dict[str, Any]:
    sub = WebhookSubscription(
        url=input_data["url"],
        events=input_data.get("events", []),
        secret=input_data.get("secret", ""),
        enabled=input_data.get("enabled", True),
        filters=input_data.get("filters"),
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return _result(
        {"id": sub.id, "url": sub.url, "events": sub.events, "secret": sub.secret, "enabled": sub.enabled}
    )


_WEBHOOK_UPDATE_FIELDS = {"url", "events", "secret", "enabled", "filters"}


async def _webhooks_update(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(WebhookSubscription).where(WebhookSubscription.id == input_data["id"]))
    sub = result.scalar_one_or_none()
    if not sub:
        return _err("Webhook not found", "NOT_FOUND")
    for field in _WEBHOOK_UPDATE_FIELDS & set(input_data.keys()):
        setattr(sub, field, input_data[field])
    await db.commit()
    await db.refresh(sub)
    return _result(
        {"id": sub.id, "url": sub.url, "events": sub.events, "secret": sub.secret, "enabled": sub.enabled}
    )


async def _webhooks_delete(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(WebhookSubscription).where(WebhookSubscription.id == input_data["id"]))
    sub = result.scalar_one_or_none()
    if not sub:
        return _err("Webhook not found", "NOT_FOUND")
    await db.delete(sub)
    await db.commit()
    return _result({"success": True})
