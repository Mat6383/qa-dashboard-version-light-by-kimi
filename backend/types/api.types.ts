/**
 * ================================================
 * TYPES API — Inférés des schémas Zod
 * ================================================
 * Source de vérité : ../validators/index.js
 * Ces types sont consommables par le backend ET le frontend.
 */

import {
  featureFlagCreateBody,
  featureFlagUpdateBody,
  webhookCreateBody,
  webhookUpdateBody,
  syncPreviewBody,
  syncExecuteBody,
  crosstestCommentBody,
  crosstestCommentPutBody,
  reportsGenerateBody,
  autoConfigBody,
  milestonesQuery,
  runResultsQuery,
} from '../validators';

// ─── Feature Flags ───────────────────────────────────────────────────────────
export type FeatureFlagCreateInput = ReturnType<typeof featureFlagCreateBody.parse>;
export type FeatureFlagUpdateInput = ReturnType<typeof featureFlagUpdateBody.parse>;

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  rolloutPercentage: number;
  updatedAt: string;
  createdAt: string;
}

// ─── Webhooks ────────────────────────────────────────────────────────────────
export type WebhookCreateInput = ReturnType<typeof webhookCreateBody.parse>;
export type WebhookUpdateInput = ReturnType<typeof webhookUpdateBody.parse>;

export interface WebhookSubscription {
  id: number;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Sync ────────────────────────────────────────────────────────────────────
export type SyncPreviewInput = ReturnType<typeof syncPreviewBody.parse>;
export type SyncExecuteInput = ReturnType<typeof syncExecuteBody.parse>;

// ─── Crosstest ───────────────────────────────────────────────────────────────
export type CrosstestCommentInput = ReturnType<typeof crosstestCommentBody.parse>;
export type CrosstestCommentUpdateInput = ReturnType<typeof crosstestCommentPutBody.parse>;

// ─── Reports ─────────────────────────────────────────────────────────────────
export type ReportGenerateInput = ReturnType<typeof reportsGenerateBody.parse>;

// ─── Auto Config ─────────────────────────────────────────────────────────────
export type AutoConfigInput = ReturnType<typeof autoConfigBody.parse>;

// ─── Query params ────────────────────────────────────────────────────────────
export type MilestonesQuery = ReturnType<typeof milestonesQuery.parse>;
export type RunResultsQuery = ReturnType<typeof runResultsQuery.parse>;

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
