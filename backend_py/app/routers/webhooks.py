"""Outgoing webhook subscriptions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.deps import DBMain, require_admin
from app.models.webhooks import WebhookSubscription
from app.schemas import WebhookSubscriptionCreate, WebhookSubscriptionOut, WebhookSubscriptionUpdate

router = APIRouter()


@router.get("/", dependencies=[Depends(require_admin)])
async def list_webhooks(db: DBMain):
    result = await db.execute(select(WebhookSubscription))
    rows = result.scalars().all()
    return {"webhooks": [WebhookSubscriptionOut.model_validate(r) for r in rows]}


@router.post("/", dependencies=[Depends(require_admin)])
async def create_webhook(payload: WebhookSubscriptionCreate, db: DBMain):
    sub = WebhookSubscription(**payload.model_dump())
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return {"status": "created", "webhook": WebhookSubscriptionOut.model_validate(sub)}


@router.put("/{webhook_id}", dependencies=[Depends(require_admin)])
async def update_webhook(webhook_id: int, payload: WebhookSubscriptionUpdate, db: DBMain):
    result = await db.execute(select(WebhookSubscription).where(WebhookSubscription.id == webhook_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Webhook not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(sub, field, value)
    await db.commit()
    await db.refresh(sub)
    return {"status": "updated", "webhook": WebhookSubscriptionOut.model_validate(sub)}


@router.delete("/{webhook_id}", dependencies=[Depends(require_admin)])
async def delete_webhook(webhook_id: int, db: DBMain):
    result = await db.execute(select(WebhookSubscription).where(WebhookSubscription.id == webhook_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(sub)
    await db.commit()
    return {"status": "deleted"}
