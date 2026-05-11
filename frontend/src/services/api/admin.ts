/**
 * Admin API methods — anomalies, circuit breakers, audit logs, feature flags, Testmo browser
 */

import type {
  ApiResponse,
  ApiErrorResponse,
  AuditLogListResponse,
  CircuitBreakerState,
  AnomalyItem,
  FeatureFlagAdminResponse,
  FeatureFlag,
  FeatureFlagCreateInput,
  FeatureFlagUpdateInput,
} from '../../types/api.types';
import { apiClient, apiCall } from './core';

export async function getAnomalies(projectId: number): Promise<ApiResponse<AnomalyItem[]>> {
  return apiCall('Get Anomalies', async () => {
    const response = await apiClient.get(`/anomalies/${projectId}`);
    return response.data;
  });
}

export async function getCircuitBreakers(): Promise<ApiResponse<CircuitBreakerState[]>> {
  return apiCall('Get Circuit Breakers', async () => {
    const response = await apiClient.get('/health/circuit-breakers');
    return response.data;
  });
}

export async function getAuditLogs(filters: Record<string, unknown> = {}): Promise<AuditLogListResponse | ApiErrorResponse> {
  return apiCall('Get Audit Logs', async () => {
    const response = await apiClient.get('/audit', { params: filters });
    return response.data;
  });
}

export async function getFeatureFlagsAdmin(): Promise<ApiResponse<FeatureFlagAdminResponse>> {
  return apiCall('Get Feature Flags Admin', async () => {
    const response = await apiClient.get('/feature-flags/admin');
    return response.data;
  });
}

export async function createFeatureFlag(data: FeatureFlagCreateInput): Promise<ApiResponse<FeatureFlag>> {
  return apiCall('Create Feature Flag', async () => {
    const response = await apiClient.post('/feature-flags/admin', data);
    return response.data;
  });
}

export async function updateFeatureFlag(key: string, data: FeatureFlagUpdateInput): Promise<ApiResponse<FeatureFlag>> {
  return apiCall('Update Feature Flag', async () => {
    const response = await apiClient.put(`/feature-flags/admin/${key}`, data);
    return response.data;
  });
}

export async function deleteFeatureFlag(key: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiCall('Delete Feature Flag', async () => {
    const response = await apiClient.delete(`/feature-flags/admin/${key}`);
    return response.data;
  });
}

export async function createTestmoManualRun(data: {
  projectId: number;
  name: string;
  milestoneId?: number;
  configId?: number;
  caseIds?: number[];
}): Promise<ApiResponse<{ runId: number; url: string }>> {
  return apiCall('Create Testmo Manual Run', async () => {
    const response = await apiClient.post('/testmo-browser/runs', data);
    return response.data;
  });
}

export async function addTestmoManualRunResults(
  runId: number,
  data: {
    projectId: number;
    results: Array<{
      caseId?: number;
      testId?: number;
      status: string;
      note?: string;
      elapsed?: number;
    }>;
  }
): Promise<ApiResponse<{ updated: number; errors: number }>> {
  return apiCall('Add Testmo Manual Run Results', async () => {
    const response = await apiClient.post(`/testmo-browser/runs/${runId}/results`, data);
    return response.data;
  });
}

export async function checkTestmoBrowserHealth(): Promise<ApiResponse<{ ok: boolean; message: string }>> {
  return apiCall('Check Testmo Browser Health', async () => {
    const response = await apiClient.get('/testmo-browser/health');
    return response.data;
  });
}
