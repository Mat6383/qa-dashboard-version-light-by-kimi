from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas_trpc import (
    AnalyticsListInput,
    AnalyticsMarkReadInput,
    AnalyticsMarkAllReadInput,
    AnalyticsAnalyzeInput,
    AnomaliesListInput,
    DashboardMetricsInput,
    FeatureFlagGetInput,
    FeatureFlagDeleteInput,
    IntegrationIdInput,
    IntegrationCreateJiraIssueInput,
    GitlabIssuesInput,
    NotificationSettingsInput,
    NotificationSaveSettingsInput,
    NotificationTestWebhookInput,
    ReportGenerateInput,
    RetentionUpdatePolicyInput,
    RetentionArchivesInput,
    SyncPreviewCasesInput,
    SyncExecuteCasesInput,
    WebhookIdInput,
    WebhookUpdateInput,
)


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


# Map "router.procedure" → Pydantic validator (None = no validation)
VALIDATORS: dict[str, Any] = {
    # analytics
    "analytics.list": AnalyticsListInput,
    "analytics.markRead": AnalyticsMarkReadInput,
    "analytics.markAllRead": AnalyticsMarkAllReadInput,
    "analytics.analyze": AnalyticsAnalyzeInput,
    # anomalies
    "anomalies.list": AnomaliesListInput,
    "anomalies.circuitBreakers": None,
    # cache
    "cache.clear": None,
    # crosstest
    "crosstest.saveComment": None,
    "crosstest.deleteComment": None,
    # dashboard
    "dashboard.metrics": DashboardMetricsInput,
    "dashboard.qualityRates": DashboardMetricsInput,
    "dashboard.multiProjectSummary": None,
    # featureFlags
    "featureFlags.list": None,
    "featureFlags.get": FeatureFlagGetInput,
    "featureFlags.listAdmin": None,
    "featureFlags.create": None,
    "featureFlags.update": None,
    "featureFlags.delete": FeatureFlagDeleteInput,
    # integrations
    "integrations.list": None,
    "integrations.get": IntegrationIdInput,
    "integrations.create": None,
    "integrations.update": None,
    "integrations.delete": IntegrationIdInput,
    "integrations.testConnection": IntegrationIdInput,
    "integrations.createJiraIssue": IntegrationCreateJiraIssueInput,
    "integrations.gitlabProjects": IntegrationIdInput,
    "integrations.gitlabIssues": GitlabIssuesInput,
    # notifications
    "notifications.settings": NotificationSettingsInput,
    "notifications.saveSettings": NotificationSaveSettingsInput,
    "notifications.testWebhook": NotificationTestWebhookInput,
    # projects
    "projects.list": None,
    # reports
    "reports.generate": ReportGenerateInput,
    # retention
    "retention.policies": None,
    "retention.updatePolicy": RetentionUpdatePolicyInput,
    "retention.archives": RetentionArchivesInput,
    "retention.runCycle": None,
    # sync
    "sync.previewCases": SyncPreviewCasesInput,
    "sync.executeCases": SyncExecuteCasesInput,
    "sync.casesHistory": None,
    "sync.updateAutoConfig": None,
    # webhooks
    "webhooks.list": None,
    "webhooks.create": None,
    "webhooks.update": WebhookUpdateInput,
    "webhooks.delete": WebhookIdInput,
}
