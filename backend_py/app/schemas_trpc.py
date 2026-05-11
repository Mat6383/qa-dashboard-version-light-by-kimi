"""Pydantic input schemas for the Python tRPC bridge.

These models validate incoming tRPC payloads before they reach the handlers.
Field names match the camelCase keys sent by the frontend.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class AnalyticsListInput(BaseModel):
    projectId: int | None = None
    unreadOnly: bool = False
    limit: int = 50


class AnalyticsMarkReadInput(BaseModel):
    id: int


class AnalyticsMarkAllReadInput(BaseModel):
    projectId: int | None = None


class AnalyticsAnalyzeInput(BaseModel):
    projectId: int


class AnomaliesListInput(BaseModel):
    projectId: int | None = None


class DashboardMetricsInput(BaseModel):
    projectId: int | None = None
    preprodMilestones: list[int] | None = None
    prodMilestones: list[int] | None = None


class FeatureFlagGetInput(BaseModel):
    key: str


class FeatureFlagDeleteInput(BaseModel):
    key: str


class IntegrationIdInput(BaseModel):
    id: int


class IntegrationCreateJiraIssueInput(BaseModel):
    id: int
    summary: str
    description: str
    issueType: str = "Bug"


class GitlabIssuesInput(BaseModel):
    id: int
    projectId: int | None = None


class NotificationSettingsInput(BaseModel):
    projectId: int | None = None


class NotificationSaveSettingsInput(BaseModel):
    projectId: int | None = None
    email: str | None = None
    slackWebhook: str | None = None
    teamsWebhook: str | None = None
    enabledSlaEmail: bool | None = None
    enabledSlaSlack: bool | None = None
    enabledSlaTeams: bool | None = None
    emailTemplate: str | None = None
    slackTemplate: str | None = None
    teamsTemplate: str | None = None


class NotificationTestWebhookInput(BaseModel):
    channel: str = "email"
    url: str | None = None
    destination: str | None = None


class ReportGenerateInput(BaseModel):
    projectId: int
    runIds: list[int] | None = None
    milestoneId: int | None = None
    formats: dict[str, bool] = Field(default_factory=dict)
    recommendations: str | None = None
    complement: str | None = None
    lang: str = "fr"


class RetentionUpdatePolicyInput(BaseModel):
    entityType: str
    retentionDays: int | None = None
    autoArchive: bool | None = None
    autoDelete: bool | None = None


class RetentionArchivesInput(BaseModel):
    entityType: str | None = None
    limit: int = 100


class SyncPreviewCasesInput(BaseModel):
    projectId: int | str
    testmoProjectId: int | None = None
    iterationName: str = ""
    label: str = "Test::TODO"
    rootFolderId: int = 4514


class SyncExecuteCasesInput(BaseModel):
    projectId: int | str
    testmoProjectId: int | None = None
    iterationName: str = ""
    label: str = "Test::TODO"
    rootFolderId: int = 4514
    dryRun: bool = False


class WebhookIdInput(BaseModel):
    id: int


class WebhookUpdateInput(BaseModel):
    id: int
    url: str | None = None
    events: list[str] | None = None
    secret: str | None = None
    enabled: bool | None = None
    filters: dict[str, object] | None = None
