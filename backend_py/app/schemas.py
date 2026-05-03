"""Pydantic schemas for request/response validation and OpenAPI docs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Generic ─────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str


class StatusResponse(BaseModel):
    status: str


# ── Auth ────────────────────────────────────────────────

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserProfile(BaseModel):
    id: int
    gitlab_id: int
    email: str
    name: str | None = None
    avatar: str | None = None
    role: str


# ── Projects ────────────────────────────────────────────

class ProjectListResponse(BaseModel):
    projects: list[dict[str, Any]]


class RunListResponse(BaseModel):
    runs: list[dict[str, Any]]


class MilestoneListResponse(BaseModel):
    milestones: list[dict[str, Any]]


class AutomationListResponse(BaseModel):
    automation: list[dict[str, Any]]


# ── Dashboard ───────────────────────────────────────────

class DashboardMetrics(BaseModel):
    project_id: int
    pass_rate: float
    completion_rate: float
    escape_rate: float
    detection_rate: float
    blocked_rate: float
    total_tests: int
    mttr_hours: float
    lead_time_days: float


class QualityRates(BaseModel):
    escape_rate: float
    detection_rate: float
    project_id: int


class MultiProjectDashboard(BaseModel):
    projects: list[int]
    metrics: dict[str, Any]


class TrendsResponse(BaseModel):
    project_id: int
    snapshots: list[dict[str, Any]]


class AnnualTrendsResponse(BaseModel):
    trends: list[dict[str, Any]]


class CompareResponse(BaseModel):
    projects: list[dict[str, Any]]


# ── Runs ────────────────────────────────────────────────

class RunResultsResponse(BaseModel):
    results: list[dict[str, Any]]


# ── Sync ────────────────────────────────────────────────

class SyncPreviewPayload(BaseModel):
    project_id: int | str
    iteration_name: str
    run_id: int | None = None
    version: str | None = None
    source: str = "gitlab-sync"
    testmo_project_id: int | None = None


class SyncExecutePayload(BaseModel):
    project_id: int | str
    iteration_name: str
    run_id: int | None = None
    version: str | None = None
    dry_run: bool = False
    source: str = "gitlab-sync"
    testmo_project_id: int | None = None


class SyncStatusPayload(BaseModel):
    project_id: int | str
    iteration_name: str
    run_id: int | None = None


class SyncHistoryResponse(BaseModel):
    history: list[dict[str, Any]]


class AutoConfigResponse(BaseModel):
    config: dict[str, Any]


# ── Crosstest ───────────────────────────────────────────

class CrossTestCommentCreate(BaseModel):
    issue_iid: int
    gitlab_project_id: int | None = None
    milestone_context: str | None = None
    comment: str


class CrossTestCommentUpdate(BaseModel):
    comment: str
    milestone_context: str | None = None


class CrossTestCommentOut(BaseModel):
    id: int
    issue_iid: int
    gitlab_project_id: int
    milestone_context: str | None = None
    comment: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CrossTestIterationsResponse(BaseModel):
    iterations: list[dict[str, Any]]


class CrossTestIssuesResponse(BaseModel):
    issues: list[dict[str, Any]]


class CrossTestCommentsResponse(BaseModel):
    comments: list[CrossTestCommentOut]


# ── Feature Flags ───────────────────────────────────────

class FeatureFlagOut(BaseModel):
    key: str
    enabled: bool
    description: str | None = None
    rollout_percentage: float
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class FeatureFlagCreate(BaseModel):
    key: str
    enabled: bool = False
    description: str | None = None
    rollout_percentage: float = 100.0


class FeatureFlagUpdate(BaseModel):
    enabled: bool | None = None
    description: str | None = None
    rollout_percentage: float | None = None


# ── Webhooks ────────────────────────────────────────────

class WebhookSubscriptionOut(BaseModel):
    id: int
    url: str
    events: list[str]
    secret: str
    enabled: bool
    filters: dict[str, Any] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class WebhookSubscriptionCreate(BaseModel):
    url: str
    events: list[str]
    secret: str = ""
    enabled: bool = True
    filters: dict[str, Any] | None = None


class WebhookSubscriptionUpdate(BaseModel):
    url: str | None = None
    events: list[str] | None = None
    secret: str | None = None
    enabled: bool | None = None
    filters: dict[str, Any] | None = None


# ── Notifications ───────────────────────────────────────

class NotificationSettingOut(BaseModel):
    id: int
    project_id: int | None = None
    email: str | None = None
    slack_webhook: str | None = None
    teams_webhook: str | None = None
    enabled_sla_email: bool
    enabled_sla_slack: bool
    enabled_sla_teams: bool
    email_template: str | None = None
    slack_template: str | None = None
    teams_template: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class NotificationSettingCreate(BaseModel):
    project_id: int | None = None
    email: str | None = None
    slack_webhook: str | None = None
    teams_webhook: str | None = None
    enabled_sla_email: bool = False
    enabled_sla_slack: bool = False
    enabled_sla_teams: bool = False
    email_template: str | None = None
    slack_template: str | None = None
    teams_template: str | None = None


class NotificationTestPayload(BaseModel):
    channel: str = "email"  # email | slack | teams
    destination: str | None = None


# ── Audit ───────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    timestamp: datetime
    actor_id: int | None = None
    actor_email: str | None = None
    actor_role: str | None = None
    action: str
    resource: str | None = None
    resource_id: str | None = None
    method: str | None = None
    path: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    status_code: int | None = None
    details: str | None = None
    success: bool

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogOut]
    page: int
    page_size: int
    total: int


# ── Anomalies ───────────────────────────────────────────

class AnomalyOut(BaseModel):
    project_id: int
    metric: str
    value: float
    expected_range: tuple[float, float]
    z_score: float
    severity: str  # low | medium | high
    detected_at: str


class AnomalyListResponse(BaseModel):
    anomalies: list[AnomalyOut]


# ── Exports ─────────────────────────────────────────────

class ExportPayload(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    filename: str | None = None


class PdfPayload(BaseModel):
    html: str
    filename: str | None = None


class ReportPayload(BaseModel):
    run_id: int | None = None
    project_id: int | None = None
    format: str = "html"  # html | pptx | both


class ReportResponse(BaseModel):
    html: str | None = None
    pptx_base64: str | None = None
    message: str | None = None


# ── Analytics ───────────────────────────────────────────

class AnalyticsInsightOut(BaseModel):
    id: int
    project_id: int
    type: str
    title: str
    message: str
    confidence: float
    data: dict[str, Any] | None = None
    read: bool
    created_at: datetime | None = None


class AnalyticsListResponse(BaseModel):
    insights: list[AnalyticsInsightOut]


class AnalyticsMarkReadPayload(BaseModel):
    id: int


class AnalyticsAnalyzePayload(BaseModel):
    project_id: int


# ── Retention ───────────────────────────────────────────

class RetentionPolicyOut(BaseModel):
    entity_type: str
    retention_days: int
    auto_archive: bool
    auto_delete: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class RetentionPolicyUpdate(BaseModel):
    entity_type: str
    retention_days: int | None = None
    auto_archive: bool | None = None
    auto_delete: bool | None = None


class RetentionArchiveOut(BaseModel):
    id: int
    entity_type: str
    entity_id: str | None = None
    project_id: int | None = None
    data: dict[str, Any] | None = None
    archived_at: datetime | None = None


class RetentionCycleResponse(BaseModel):
    archived: int
    deleted: int


# ── Integrations ────────────────────────────────────────

class IntegrationOut(BaseModel):
    id: int
    name: str
    type: str
    config: dict[str, Any] = Field(validation_alias="config_json")
    enabled: bool
    last_sync_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class IntegrationCreate(BaseModel):
    name: str
    type: str  # jira | azure_devops | generic_webhook | gitlab
    config: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class IntegrationUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    config: dict[str, Any] | None = None
    enabled: bool | None = None


class JiraIssueCreate(BaseModel):
    id: int
    summary: str
    description: str
    issue_type: str = "Bug"


# ── Cache / Backup / Metrics ────────────────────────────

class CacheClearResponse(BaseModel):
    status: str


class BackupListResponse(BaseModel):
    backups: list[dict[str, Any]]


class CustomMetricsResponse(BaseModel):
    metrics: dict[str, Any]
