"""tRPC bridge — translates tRPC batch requests into internal service calls.

Compatible with @trpc/react-query httpBatchLink (v10, no transformer).
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import ValidationError

from app.database import get_main_db
from app.deps import require_auth
from app.routers.trpc._common import VALIDATORS
from app.routers.trpc.analytics import (
    _analytics_list,
    _analytics_mark_read,
    _analytics_mark_all_read,
    _analytics_analyze,
)
from app.routers.trpc.anomalies import _anomalies_list, _anomalies_circuit_breakers
from app.routers.trpc.cache import _cache_clear
from app.routers.trpc.crosstest import _crosstest_save_comment, _crosstest_delete_comment
from app.routers.trpc.dashboard import (
    _dashboard_metrics,
    _dashboard_quality_rates,
    _dashboard_multi_project_summary,
)
from app.routers.trpc.feature_flags import (
    _feature_flags_list,
    _feature_flags_get,
    _feature_flags_list_admin,
    _feature_flags_create,
    _feature_flags_update,
    _feature_flags_delete,
)
from app.routers.trpc.integrations import (
    _integrations_list,
    _integrations_get,
    _integrations_create,
    _integrations_update,
    _integrations_delete,
    _integrations_test,
    _integrations_create_jira_issue,
    _integrations_gitlab_projects,
    _integrations_gitlab_issues,
)
from app.routers.trpc.notifications import (
    _notifications_settings,
    _notifications_save_settings,
    _notifications_test_webhook,
)
from app.routers.trpc.projects import _projects_list
from app.routers.trpc.reports import _reports_generate
from app.routers.trpc.retention import (
    _retention_policies,
    _retention_update_policy,
    _retention_archives,
    _retention_run_cycle,
)
from app.routers.trpc.sync import (
    _sync_update_auto_config,
    _sync_preview_cases,
    _sync_execute_cases,
    _sync_cases_history,
)
from app.routers.trpc.webhooks import (
    _webhooks_list,
    _webhooks_create,
    _webhooks_update,
    _webhooks_delete,
)
from app.utils.api_helpers import SAFE_INTERNAL_ERROR
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(dependencies=[Depends(require_auth)])


async def _db():
    async with get_main_db() as db:
        yield db


# ── Procedure registry ──────────────────────────────────

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
    "sync.previewCases": _sync_preview_cases,
    "sync.executeCases": _sync_execute_cases,
    "sync.casesHistory": _sync_cases_history,
    "sync.updateAutoConfig": _sync_update_auto_config,
    # webhooks
    "webhooks.list": _webhooks_list,
    "webhooks.create": _webhooks_create,
    "webhooks.update": _webhooks_update,
    "webhooks.delete": _webhooks_delete,
}


async def _run_procedure(path: str, raw_input: dict[str, Any] | None, db: Any, call_id: Any) -> dict[str, Any]:
    """Execute a single tRPC procedure with unified error handling."""
    handler = PROCEDURES.get(path)
    if not handler:
        return {"error": {"message": f"Unknown procedure: {path}", "code": "NOT_FOUND"}, "id": call_id}

    validator = VALIDATORS.get(path)
    if validator is not None:
        try:
            validated = validator.model_validate(raw_input or {})
            raw_input = validated.model_dump()
        except ValidationError as exc:
            return {"error": {"message": str(exc), "code": "BAD_REQUEST"}, "id": call_id}

    try:
        result = await handler(raw_input, db)
        result["id"] = call_id
        return result
    except Exception as exc:
        logger.error("tRPC error in %s: %s", path, exc, exc_info=True)
        return {"error": {"message": SAFE_INTERNAL_ERROR, "code": "INTERNAL_SERVER_ERROR"}, "id": call_id}


async def _handle_batch(paths: list[str], inputs: dict[str, Any], db: Any) -> list[dict[str, Any]]:
    responses = []
    for idx, path in enumerate(paths):
        call_id = idx
        raw_input = inputs.get(str(idx), {})
        if isinstance(raw_input, dict) and "json" in raw_input:
            raw_input = raw_input["json"]
        responses.append(await _run_procedure(path, raw_input, db, call_id))
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
            if "input" in call:
                raw_input = call["input"]
            elif "params" in call and "input" in call["params"]:
                raw_input = call["params"]["input"]
            else:
                raw_input = call.get("json", {})
            responses.append(await _run_procedure(path, raw_input, db, call_id))

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
