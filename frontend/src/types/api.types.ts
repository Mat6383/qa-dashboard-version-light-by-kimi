/**
 * Types API frontend — miroir des types backend.
 * Source de vérité : backend/types/api.types.ts
 */

// ─── Feature Flags ───────────────────────────────────────────────────────────
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  rolloutPercentage: number;
  updatedAt: string;
  createdAt: string;
}

export interface FeatureFlagCreateInput {
  key: string;
  enabled?: boolean;
  description?: string;
  rolloutPercentage?: number;
}

export interface FeatureFlagUpdateInput {
  enabled?: boolean;
  description?: string;
  rolloutPercentage?: number;
}

// ─── Integrations ────────────────────────────────────────────────────────────
export interface Integration {
  id: number;
  name: string;
  type: 'jira' | 'azure_devops' | 'generic_webhook' | 'gitlab';
  config: Record<string, unknown>;
  enabled: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Webhooks ────────────────────────────────────────────────────────────────
export interface WebhookSubscription {
  id: number;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Projects ────────────────────────────────────────────────────────────────
export interface Project {
  id: number;
  name: string;
}

// ─── Dashboard Metrics ───────────────────────────────────────────────────────
export interface DashboardMetrics {
  completionRate: number;
  passRate: number;
  failureRate: number;
  blockedRate: number;
  escapeRate: number;
  detectionRate: number;
  testEfficiency: number;
  qualityRates: QualityRates | null;
  raw: RawMetrics;
  runs: Run[];
  slaStatus: SlaStatus;
}

export interface QualityRates {
  escapeRate: number;
  detectionRate: number;
}

export interface RawMetrics {
  completed: number;
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  wip: number;
  untested: number;
  success: number;
  failure: number;
}

export interface Run {
  id: number | string;
  name: string;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  blocked: number;
  wip: number;
  untested: number;
  completionRate: number;
  passRate: number;
  isExploratory: boolean;
  isClosed: boolean;
  created_at: string;
}

export interface SlaStatus {
  ok: boolean;
  alerts: Array<{ severity: string; metric: string }>;
}

// ─── Réponses standard ───────────────────────────────────────────────────────
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Type guard pour vérifier si une réponse API est un succès.
 */
export function isApiSuccess<T>(res: ApiResponse<T>): res is ApiSuccessResponse<T> {
  return res.success === true;
}

/**
 * Déstructure une réponse API en vérifiant le succès.
 * Lance une Error si la réponse est en échec.
 */
export function unwrapApiResponse<T>(res: ApiResponse<T>): T {
  if (!isApiSuccess(res)) {
    throw new Error(res.error);
  }
  return res.data;
}

// ─── Milestones ──────────────────────────────────────────────────────────────
export interface Milestone {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

export interface MilestoneListResponse {
  result: Milestone[];
}

// ─── Sync ────────────────────────────────────────────────────────────────────
export interface SyncProject {
  id: string;
  label: string;
  configured: boolean;
}

export interface SyncIteration {
  id: number;
  title: string;
  state: string;
  web_url?: string;
}

export interface SyncPreviewResult {
  iteration: { name: string; id: number };
  folder: string | null;
  issues: Array<{
    iid: number;
    url: string;
    title: string;
    status: 'create' | 'update' | 'skip';
  }>;
  summary: {
    toCreate: number;
    toUpdate: number;
    toSkip: number;
    total: number;
  };
  run_action?: 'use_existing' | 'create_new' | 'run_not_found' | 'none';
  target_run?: {
    id: number | null;
    name: string;
    source: string;
  };
  status_breakdown?: Record<string, number>;
}

export interface SyncHistoryEntry {
  id: number;
  project_name: string;
  iteration_name: string;
  mode: string;
  created: number;
  updated: number;
  skipped: number;
  enriched: number;
  errors: number;
  total_issues: number;
  testmo_run_id: number | null;
  testmo_run_url: string | null;
  executed_at: string;
}

// ─── Crosstest ───────────────────────────────────────────────────────────────
export interface CrosstestIssue {
  iid: number;
  title: string;
  url: string;
  state: string;
  assignees: Array<{ name: string; avatar_url?: string }>;
  labels: string[];
}

export interface CrosstestComment {
  issue_iid: number;
  comment: string;
  milestone_context: string | null;
  updated_at: string;
}

// ─── Auto-Sync Config ────────────────────────────────────────────────────────
export interface AutoSyncConfig {
  enabled: boolean;
  runId: number | null;
  iterationName: string | null;
  gitlabProjectId: string | null;
  updatedAt: string | null;
  version?: string | null;
}

// ─── Notifications ───────────────────────────────────────────────────────────
export interface NotificationSettings {
  projectId?: number;
  slackWebhook?: string;
  teamsWebhook?: string;
  emailRecipients?: string[];
  slaAlertsEnabled?: boolean;
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────
export interface AuditLog {
  id: number;
  timestamp: string;
  actor_id: number | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  method: string | null;
  path: string | null;
  ip: string | null;
  user_agent: string | null;
  status_code: number | null;
  details: unknown;
  success: boolean;
}

export interface AuditLogListResponse extends ApiSuccessResponse<AuditLog[]> {
  total: number;
  limit: number;
  offset: number;
}

// ─── Circuit Breakers ────────────────────────────────────────────────────────
export interface CircuitBreakerState {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailure: string | null;
}

// ─── Anomalies ───────────────────────────────────────────────────────────────
export interface AnomalyItem {
  metric: string;
  value: number;
  zScore: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

// ─── Multi-Project Summary ───────────────────────────────────────────────────
export interface MultiProjectSummaryItem {
  projectId: number;
  projectName: string;
  passRate: number | null;
  completionRate: number | null;
  blockedRate: number | null;
  escapeRate: number | null;
  detectionRate: number | null;
  slaStatus: { ok: boolean; alerts: Array<{ severity: string; metric: string }> };
}

// ─── Feature Flags Admin ─────────────────────────────────────────────────────
export interface MetricAlert {
  severity: 'warning' | 'critical' | string;
  message: string;
}

export interface Trend {
  direction?: 'up' | 'down' | 'stable';
  severity?: 'critical' | string;
  zScore: number;
  mean?: number;
}

export interface FeatureFlagAdminResponse {
  flags: FeatureFlag[];
}
