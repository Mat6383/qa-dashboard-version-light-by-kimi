"""tRPC bridge — translates tRPC batch requests into internal service calls.

Compatible with @trpc/react-query httpBatchLink (v10, no transformer).
"""

from __future__ import annotations

import json
import traceback
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import delete, select

from app.database import get_comments_db, get_main_db
from app.deps import require_auth
from app.models.comments import CrossTestComment
from app.models.feature_flags import FeatureFlag
from app.models.integrations import Integration
from app.models.notifications import NotificationSetting
from app.models.webhooks import WebhookSubscription
from app.schemas import (
    AnalyticsAnalyzePayload,
    AnalyticsMarkReadPayload,
    IntegrationCreate,
    IntegrationUpdate,
    JiraIssueCreate,
    RetentionPolicyUpdate,
    WebhookSubscriptionCreate,
    WebhookSubscriptionUpdate,
)
from app.services.alerting import alerting_service
from app.services.analytics import analytics_service
from app.services.anomaly import anomaly_service
from app.services.gitlab_connector import gitlab_connector_service
from app.services.jira import integration_service
from app.services.report import report_service
from app.services.retention import retention_service
from app.services.sync import sync_service
from app.services.testmo import testmo_service
from app.services.webhook_emitter import webhook_emitter
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


async def _db():
    async with get_main_db() as db:
        yield db


def _ok(data: Any) -> dict[str, Any]:
    return {"result": {"data": data}}


def _err(message: str, code: str = "INTERNAL_SERVER_ERROR") -> dict[str, Any]:
    return {"error": {"message": message, "code": code}}


def _result(data: Any = None, **kwargs: Any) -> dict[str, Any]:
    """Build a tRPC response compatible with the Node.js router format."""
    payload: dict[str, Any] = {"success": True, **kwargs}
    if data is not None:
        payload["data"] = data
    payload["timestamp"] = datetime.now(timezone.utc).isoformat()
    return _ok(payload)


# ── Procedure registry ──────────────────────────────────

async def _analytics_list(input_data: dict[str, Any], db) -> dict[str, Any]:
    insights = await analytics_service.get_insights(
        db,
        project_id=input_data.get("projectId"),
        unread_only=input_data.get("unreadOnly", False),
        limit=input_data.get("limit", 50),
    )
    return _ok(insights)


async def _analytics_mark_read(input_data: dict[str, Any], db) -> dict[str, Any]:
    ok = await analytics_service.mark_as_read(db, input_data["id"])
    return _result({"success": ok})


async def _analytics_mark_all_read(input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    count = await analytics_service.mark_all_as_read(
        db, project_id=(input_data or {}).get("projectId")
    )
    return _result({"success": True, "count": count})


async def _analytics_analyze(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await analytics_service.analyze_project(db, input_data["projectId"])
    return _ok(result)


async def _anomalies_list(input_data: dict[str, Any], db) -> dict[str, Any]:
    project_id = input_data.get("projectId")
    anomalies = await anomaly_service.detect(project_id)
    return _result(anomalies)


async def _anomalies_circuit_breakers(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    from app.routers.health import _CIRCUIT_BREAKERS

    data = [
        {
            "name": name,
            "state": cb.state.value,
            "failure_count": cb._failure_count,
        }
        for name, cb in _CIRCUIT_BREAKERS.items()
    ]
    return _result(data)


async def _cache_clear(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    testmo_service.clear_cache()
    return _result({"success": True, "message": "Cache cleared successfully"})


async def _crosstest_save_comment(input_data: dict[str, Any], db) -> dict[str, Any]:
    async with get_comments_db() as cdb:
        comment = CrossTestComment(
            issue_iid=input_data["issue_iid"],
            gitlab_project_id=input_data.get("gitlab_project_id", 63),
            milestone_context=input_data.get("milestone_context"),
            comment=input_data["comment"],
        )
        cdb.add(comment)
        await cdb.commit()
        await cdb.refresh(comment)
        return _result(
            {
                "comment": {
                    "id": comment.id,
                    "issue_iid": comment.issue_iid,
                    "comment": comment.comment,
                    "milestone_context": comment.milestone_context,
                    "created_at": comment.created_at.isoformat() if comment.created_at else None,
                }
            }
        )


async def _crosstest_delete_comment(input_data: dict[str, Any], db) -> dict[str, Any]:
    async with get_comments_db() as cdb:
        stmt = delete(CrossTestComment).where(CrossTestComment.id == input_data["iid"])
        result = await cdb.execute(stmt)
        await cdb.commit()
        return _result({"success": True, "deleted": result.rowcount > 0})


async def _dashboard_metrics(input_data: dict[str, Any], db) -> dict[str, Any]:
    project_id = input_data.get("projectId")
    metrics = await testmo_service.get_project_metrics(project_id)
    return _result(metrics)


async def _dashboard_quality_rates(input_data: dict[str, Any], db) -> dict[str, Any]:
    project_id = input_data.get("projectId")
    preprod = input_data.get("preprodMilestones")
    prod = input_data.get("prodMilestones")
    rates = await testmo_service.get_escape_and_detection_rates(project_id, preprod, prod)
    return _result(rates)


async def _dashboard_multi_project_summary(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    projects = await testmo_service.get_projects()
    summaries = []
    for p in projects:
        try:
            metrics = await testmo_service.get_project_metrics(p["id"])
            summaries.append(
                {
                    "projectId": p["id"],
                    "projectName": p.get("name"),
                    "passRate": metrics.get("pass_rate"),
                    "completionRate": metrics.get("completion_rate"),
                    "blockedRate": metrics.get("blocked_rate"),
                    "escapeRate": metrics.get("escape_rate"),
                    "detectionRate": metrics.get("detection_rate"),
                    "timestamp": metrics.get("timestamp"),
                }
            )
        except Exception as exc:
            logger.warning("MultiProject metric failed for %s: %s", p.get("id"), exc)
            summaries.append(
                {
                    "projectId": p["id"],
                    "projectName": p.get("name"),
                    "passRate": None,
                    "completionRate": None,
                    "blockedRate": None,
                    "escapeRate": None,
                    "detectionRate": None,
                    "slaStatus": {
                        "ok": False,
                        "alerts": [{"severity": "error", "message": "Données indisponibles"}],
                    },
                    "timestamp": __import__("datetime").datetime.now(
                        __import__("datetime").timezone.utc
                    ).isoformat(),
                }
            )
    return _result(summaries)


async def _feature_flags_list(input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag))
    rows = result.scalars().all()
    return _result(
        {
            "flags": [
                {"key": r.key, "enabled": r.enabled, "rolloutPercentage": r.rollout_percentage}
                for r in rows
            ]
        }
    )


async def _feature_flags_get(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == input_data["key"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Flag not found", "NOT_FOUND")
    return _result(
        {
            "flag": {
                "key": row.key,
                "enabled": row.enabled,
                "rolloutPercentage": row.rollout_percentage,
                "description": row.description,
            }
        }
    )


async def _feature_flags_list_admin(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag))
    rows = result.scalars().all()
    return _result(
        {
            "flags": [
                {
                    "key": r.key,
                    "enabled": r.enabled,
                    "description": r.description,
                    "rolloutPercentage": r.rollout_percentage,
                }
                for r in rows
            ]
        }
    )


async def _feature_flags_create(input_data: dict[str, Any], db) -> dict[str, Any]:
    existing = await db.execute(select(FeatureFlag).where(FeatureFlag.key == input_data["key"]))
    if existing.scalar_one_or_none():
        return _err("Flag already exists", "CONFLICT")
    flag = FeatureFlag(**{k: v for k, v in input_data.items() if k != "id"})
    db.add(flag)
    await db.commit()
    await db.refresh(flag)
    return _result(
        {
            "flag": {
                "key": flag.key,
                "enabled": flag.enabled,
                "description": flag.description,
                "rolloutPercentage": flag.rollout_percentage,
            }
        }
    )


async def _feature_flags_update(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == input_data["key"]))
    flag = result.scalar_one_or_none()
    if not flag:
        return _err("Flag not found", "NOT_FOUND")
    data = {k: v for k, v in input_data.items() if k != "key" and v is not None}
    for field, value in data.items():
        setattr(flag, field, value)
    await db.commit()
    await db.refresh(flag)
    return _result(
        {
            "flag": {
                "key": flag.key,
                "enabled": flag.enabled,
                "description": flag.description,
                "rolloutPercentage": flag.rollout_percentage,
            }
        }
    )


async def _feature_flags_delete(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == input_data["key"]))
    flag = result.scalar_one_or_none()
    if not flag:
        return _err("Flag not found", "NOT_FOUND")
    await db.delete(flag)
    await db.commit()
    return _ok({"success": True})


async def _notifications_settings(input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    project_id = (input_data or {}).get("projectId")
    stmt = select(NotificationSetting).where(NotificationSetting.project_id == project_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    return _result(
        {
            "id": row.id,
            "project_id": row.project_id,
            "email": row.email,
            "slack_webhook": row.slack_webhook,
            "teams_webhook": row.teams_webhook,
            "enabled_sla_email": row.enabled_sla_email,
            "enabled_sla_slack": row.enabled_sla_slack,
            "enabled_sla_teams": row.enabled_sla_teams,
        }
        if row
        else None
    )


async def _notifications_save_settings(input_data: dict[str, Any], db) -> dict[str, Any]:
    project_id = input_data.get("projectId")
    result = await db.execute(
        select(NotificationSetting).where(NotificationSetting.project_id == project_id)
    )
    setting = result.scalar_one_or_none()
    if setting:
        for field in [
            "email",
            "slack_webhook",
            "teams_webhook",
            "enabled_sla_email",
            "enabled_sla_slack",
            "enabled_sla_teams",
            "email_template",
            "slack_template",
            "teams_template",
        ]:
            if field in input_data:
                setattr(setting, field, input_data[field])
    else:
        setting = NotificationSetting(
            project_id=project_id,
            **{k: v for k, v in input_data.items() if k != "projectId"},
        )
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return _result({"id": setting.id, "project_id": setting.project_id})


async def _notifications_test_webhook(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await alerting_service.send_test(
        input_data.get("channel", "email"),
        input_data.get("url") or input_data.get("destination"),
    )
    return _result(result)


async def _projects_list(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    projects = await testmo_service.get_projects()
    return _result(projects)


async def _reports_generate(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await report_service.generate(input_data)
    return _result(result)


async def _retention_policies(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    policies = await retention_service.get_policies(db)
    return _ok(policies)


async def _retention_update_policy(input_data: dict[str, Any], db) -> dict[str, Any]:
    policy = await retention_service.update_policy(
        db,
        input_data["entityType"],
        input_data.get("retentionDays"),
        input_data.get("autoArchive"),
        input_data.get("autoDelete"),
    )
    return _ok(policy)


async def _retention_archives(input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    archives = await retention_service.get_archives(
        db,
        entity_type=(input_data or {}).get("entityType"),
        limit=(input_data or {}).get("limit", 100),
    )
    return _ok(archives)


async def _retention_run_cycle(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    result = await retention_service.run_retention_cycle(db)
    return _ok(result)


async def _integrations_list(_input_data: dict[str, Any] | None, db) -> dict[str, Any]:
    result = await db.execute(select(Integration))
    rows = result.scalars().all()
    return _ok(
        [
            {"id": r.id, "name": r.name, "type": r.type, "config": r.config_json, "enabled": r.enabled}
            for r in rows
        ]
    )


async def _integrations_get(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    return _ok(
        {"id": row.id, "name": row.name, "type": row.type, "config": row.config_json, "enabled": row.enabled}
    )


async def _integrations_create(input_data: dict[str, Any], db) -> dict[str, Any]:
    integration = Integration(
        name=input_data["name"],
        type=input_data["type"],
        config_json=input_data.get("config", {}),
        enabled=input_data.get("enabled", True),
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return _ok(
        {"id": integration.id, "name": integration.name, "type": integration.type, "config": integration.config_json, "enabled": integration.enabled}
    )


async def _integrations_update(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if "name" in input_data:
        row.name = input_data["name"]
    if "type" in input_data:
        row.type = input_data["type"]
    if "config" in input_data:
        row.config_json = input_data["config"]
    if "enabled" in input_data:
        row.enabled = input_data["enabled"]
    await db.commit()
    await db.refresh(row)
    return _ok(
        {"id": row.id, "name": row.name, "type": row.type, "config": row.config_json, "enabled": row.enabled}
    )


async def _integrations_delete(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    await db.delete(row)
    await db.commit()
    return _result({"success": True})


async def _integrations_test(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if row.type == "jira":
        resp = await integration_service.test_jira_connection(row.config_json)
    elif row.type == "gitlab":
        resp = await integration_service.test_gitlab_connection(row.config_json)
    elif row.type == "generic_webhook":
        from datetime import datetime, timezone
        resp = await integration_service.send_generic_webhook(
            row.config_json, {"event": "test", "timestamp": datetime.now(timezone.utc).isoformat()}
        )
    else:
        return _err("Type not supported for test")
    return _ok(resp)


async def _integrations_create_jira_issue(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if row.type != "jira":
        return _err("Integration is not Jira", "BAD_REQUEST")
    resp = await integration_service.create_jira_issue(
        row.config_json,
        input_data["summary"],
        input_data["description"],
        input_data.get("issueType", "Bug"),
    )
    if resp.get("success"):
        from datetime import datetime, timezone
        row.last_sync_at = datetime.now(timezone.utc)
        await db.commit()
    return _ok(resp)


async def _integrations_gitlab_projects(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if row.type != "gitlab":
        return _err("Integration is not GitLab", "BAD_REQUEST")
    projects = await gitlab_connector_service.list_projects(row.config_json)
    return _result({"projects": projects})


async def _integrations_gitlab_issues(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(Integration).where(Integration.id == input_data["id"]))
    row = result.scalar_one_or_none()
    if not row:
        return _err("Integration not found", "NOT_FOUND")
    if row.type != "gitlab":
        return _err("Integration is not GitLab", "BAD_REQUEST")
    issues = await gitlab_connector_service.list_issues(row.config_json, input_data.get("projectId"))
    return _result({"issues": issues})


async def _sync_update_auto_config(input_data: dict[str, Any], db) -> dict[str, Any]:
    updated = await sync_service.update_auto_config(input_data)
    return _result({"config": updated})


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
    sub = WebhookSubscription(**input_data)
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return _result(
        {"id": sub.id, "url": sub.url, "events": sub.events, "secret": sub.secret, "enabled": sub.enabled}
    )


async def _webhooks_update(input_data: dict[str, Any], db) -> dict[str, Any]:
    result = await db.execute(select(WebhookSubscription).where(WebhookSubscription.id == input_data["id"]))
    sub = result.scalar_one_or_none()
    if not sub:
        return _err("Webhook not found", "NOT_FOUND")
    data = {k: v for k, v in input_data.items() if k != "id" and v is not None}
    for field, value in data.items():
        setattr(sub, field, value)
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


# Map "router.procedure" → handler
PROCEDURES: dict[str, Any] = {
    # analytics
    "analytics.list": _analytics_list,
    "analytics.markRead": _analytics_mark_read,
    "analytics.markAllRead": _analytics_mark_all_read,
    "analytics.analyze": _analytics_analyze,
    # anomalies
    "anomalies.list": _anomalies_list,
    "anomalies.circuitBreakers": _anomalies_circuit_breakers,
    # cache
    "cache.clear": _cache_clear,
    # crosstest
    "crosstest.saveComment": _crosstest_save_comment,
    "crosstest.deleteComment": _crosstest_delete_comment,
    # dashboard
    "dashboard.metrics": _dashboard_metrics,
    "dashboard.qualityRates": _dashboard_quality_rates,
    "dashboard.multiProjectSummary": _dashboard_multi_project_summary,
    # featureFlags
    "featureFlags.list": _feature_flags_list,
    "featureFlags.get": _feature_flags_get,
    "featureFlags.listAdmin": _feature_flags_list_admin,
    "featureFlags.create": _feature_flags_create,
    "featureFlags.update": _feature_flags_update,
    "featureFlags.delete": _feature_flags_delete,
    # integrations
    "integrations.list": _integrations_list,
    "integrations.get": _integrations_get,
    "integrations.create": _integrations_create,
    "integrations.update": _integrations_update,
    "integrations.delete": _integrations_delete,
    "integrations.testConnection": _integrations_test,
    "integrations.createJiraIssue": _integrations_create_jira_issue,
    "integrations.gitlabProjects": _integrations_gitlab_projects,
    "integrations.gitlabIssues": _integrations_gitlab_issues,
    # notifications
    "notifications.settings": _notifications_settings,
    "notifications.saveSettings": _notifications_save_settings,
    "notifications.testWebhook": _notifications_test_webhook,
    # projects
    "projects.list": _projects_list,
    # reports
    "reports.generate": _reports_generate,
    # retention
    "retention.policies": _retention_policies,
    "retention.updatePolicy": _retention_update_policy,
    "retention.archives": _retention_archives,
    "retention.runCycle": _retention_run_cycle,
    # sync
    "sync.updateAutoConfig": _sync_update_auto_config,
    # webhooks
    "webhooks.list": _webhooks_list,
    "webhooks.create": _webhooks_create,
    "webhooks.update": _webhooks_update,
    "webhooks.delete": _webhooks_delete,
}


async def _handle_batch(paths: list[str], inputs: dict[str, Any], db: Any) -> list[dict[str, Any]]:
    responses = []
    for idx, path in enumerate(paths):
        call_id = idx
        raw_input = inputs.get(str(idx), {})
        if isinstance(raw_input, dict) and "json" in raw_input:
            raw_input = raw_input["json"]
        handler = PROCEDURES.get(path)
        if not handler:
            responses.append({"error": {"message": f"Unknown procedure: {path}", "code": "NOT_FOUND"}, "id": call_id})
            continue
        try:
            result = await handler(raw_input, db)
            result["id"] = call_id
            responses.append(result)
        except Exception as exc:
            logger.error("tRPC error in %s: %s", path, exc)
            responses.append({"error": {"message": str(exc), "code": "INTERNAL_SERVER_ERROR"}, "id": call_id})
    return responses


@router.post("/")
async def trpc_batch(request: Request):
    """Handle tRPC batch POST requests."""
    body = await request.json()
    calls = body if isinstance(body, list) else [body]

    async with get_main_db() as db:
        responses = []
        for call in calls:
            call_id = call.get("id")
            path = call.get("path") or call.get("params", {}).get("path")
            raw_input = call.get("input") or call.get("params", {}).get("input") or call.get("json", {})

            handler = PROCEDURES.get(path)
            if not handler:
                responses.append({"error": {"message": f"Unknown procedure: {path}", "code": "NOT_FOUND"}, "id": call_id})
                continue

            try:
                result = await handler(raw_input, db)
                result["id"] = call_id
                responses.append(result)
            except Exception as exc:
                logger.error("tRPC error in %s: %s", path, exc)
                responses.append({"error": {"message": str(exc), "code": "INTERNAL_SERVER_ERROR"}, "id": call_id})

    return responses


@router.get("/{procedures}")
async def trpc_batch_get(
    request: Request,
    procedures: str,
    batch: str = Query(None),
    input_json: str = Query(None, alias="input"),
):
    """Handle tRPC batch GET requests (httpBatchLink queries)."""
    paths = procedures.split(",")
    inputs: dict[str, Any] = {}
    if input_json:
        try:
            inputs = json.loads(input_json)
        except json.JSONDecodeError:
            inputs = {}

    async with get_main_db() as db:
        responses = await _handle_batch(paths, inputs, db)

    return responses
