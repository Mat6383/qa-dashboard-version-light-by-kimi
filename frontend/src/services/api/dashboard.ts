/**
 * Dashboard & project/run API methods
 */

import type {
  Project,
  DashboardMetrics,
  QualityRates,
  MilestoneListResponse,
  ApiResponse,
  MultiProjectSummaryItem,
} from '../../types/api.types';
import { apiClient, apiCall, handleError } from './core';
import type { AxiosError } from 'axios';

export async function healthCheck(): Promise<{ status: string }> {
  return apiCall('Health Check', async () => {
    const response = await apiClient.get('/health');
    return response.data;
  });
}

export async function getProjects(): Promise<ApiResponse<{ result: Project[] }>> {
  return apiCall('Get Projects', async () => {
    const response = await apiClient.get('/projects');
    return response.data;
  });
}

export async function getMultiProjectSummary(): Promise<ApiResponse<MultiProjectSummaryItem[]>> {
  return apiCall('Get Multi-Project Summary', async () => {
    const response = await apiClient.get('/dashboard/multi');
    return response.data;
  });
}

export async function getDashboardMetrics(
  projectId: number,
  preprodMilestones: number[] | null = null,
  prodMilestones: number[] | null = null,
  signal: AbortSignal | null = null
): Promise<ApiResponse<DashboardMetrics>> {
  try {
    const params: Record<string, string> = {};
    if (preprodMilestones) params.preprodMilestones = preprodMilestones.join(',');
    if (prodMilestones) params.prodMilestones = prodMilestones.join(',');
    const config: { params: Record<string, string>; signal?: AbortSignal } = { params };
    if (signal) config.signal = signal;
    const response = await apiClient.get(`/dashboard/${projectId}`, config);
    return response.data;
  } catch (error) {
    if (
      (error as Error).name === 'AbortError' ||
      (error as Error).name === 'CanceledError'
    ) {
      throw error;
    }
    throw handleError('Get Dashboard Metrics', error as AxiosError | Error);
  }
}

export async function getQualityRates(
  projectId: number,
  preprodMilestones: number[] | null = null,
  prodMilestones: number[] | null = null,
  signal: AbortSignal | null = null
): Promise<ApiResponse<QualityRates>> {
  try {
    const params: Record<string, string> = {};
    if (preprodMilestones) params.preprodMilestones = preprodMilestones.join(',');
    if (prodMilestones) params.prodMilestones = prodMilestones.join(',');
    const config: { params: Record<string, string>; signal?: AbortSignal } = { params };
    if (signal) config.signal = signal;
    const response = await apiClient.get(`/dashboard/${projectId}/quality-rates`, config);
    return response.data;
  } catch (error) {
    if (
      (error as Error).name === 'AbortError' ||
      (error as Error).name === 'CanceledError'
    ) {
      throw error;
    }
    return { success: false } as ApiResponse<QualityRates>;
  }
}

export async function getProjectRuns(projectId: number, activeOnly = true): Promise<unknown> {
  return apiCall('Get Project Runs', async () => {
    const response = await apiClient.get(`/projects/${projectId}/runs`, {
      params: { active: activeOnly },
    });
    return response.data;
  });
}

export async function getProjectMilestones(projectId: number): Promise<MilestoneListResponse> {
  return apiCall('Get Project Milestones', async () => {
    const response = await apiClient.get(`/projects/${projectId}/milestones`);
    return response.data.data;
  });
}

export async function getRunDetails(runId: number): Promise<unknown> {
  return apiCall('Get Run Details', async () => {
    const response = await apiClient.get(`/runs/${runId}`);
    return response.data;
  });
}

export async function getRunResults(runId: number, statusFilter: string | null = null): Promise<unknown> {
  return apiCall('Get Run Results', async () => {
    const params = statusFilter ? { status: statusFilter } : {};
    const response = await apiClient.get(`/runs/${runId}/results`, { params });
    return response.data;
  });
}

export async function getAutomationRuns(projectId: number): Promise<unknown> {
  return apiCall('Get Automation Runs', async () => {
    const response = await apiClient.get(`/projects/${projectId}/automation`);
    return response.data;
  });
}

export async function getAnnualTrends(projectId: number): Promise<unknown> {
  return apiCall('Get Annual Trends', async () => {
    const response = await apiClient.get(`/dashboard/${projectId}/annual-trends`);
    return response.data;
  });
}

export async function clearCache(): Promise<unknown> {
  return apiCall('Clear Cache', async () => {
    const response = await apiClient.post('/cache/clear');
    return response.data;
  });
}
