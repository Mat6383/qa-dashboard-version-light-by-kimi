/**
 * Sync (GitLab → Testmo) API methods
 */

import type {
  SyncProject,
  SyncIteration,
  SyncPreviewResult,
  SyncHistoryEntry,
  AutoSyncConfig,
} from '../../types/api.types';
import { apiClient, apiCall, mapSnakeToCamel, mapCamelToSnake } from './core';

export async function getSyncProjects(): Promise<SyncProject[]> {
  return apiCall('Get Sync Projects', async () => {
    const response = await apiClient.get('/sync/projects');
    return (response.data.data as any[]).map(mapSnakeToCamel) as SyncProject[];
  });
}

export async function getSyncIterations(projectId: string, search = ''): Promise<SyncIteration[]> {
  return apiCall('Get Sync Iterations', async () => {
    const response = await apiClient.get(`/sync/${projectId}/iterations`, {
      params: search ? { search } : {},
    });
    return response.data.data;
  });
}

export async function previewSync(
  projectId: string,
  iterationName: string,
  filters: { labelCustom?: string; status?: string; version?: string; versionDeTest?: string; source?: string } = {}
): Promise<SyncPreviewResult> {
  return apiCall('Preview Sync', async () => {
    const response = await apiClient.post(
      '/sync/preview',
      { projectId, iterationName, ...filters },
      { timeout: 60000 }
    );
    return response.data.data;
  });
}

export async function previewSyncCases(
  projectId: string | number,
  iterationName: string,
  options: {
    label?: string;
    rootFolderId?: number;
    testmoProjectId?: number;
    gitlab_status?: string;
    version_prod?: string;
    version_test?: string;
    run_name?: string;
  } = {}
): Promise<SyncPreviewResult> {
  return apiCall('Preview Sync Cases', async () => {
    const response = await apiClient.post(
      '/sync/cases/preview',
      { project_id: projectId, iteration_name: iterationName, ...options },
      { timeout: 60000 }
    );
    return response.data.data;
  });
}

export async function getSyncHistory(): Promise<SyncHistoryEntry[]> {
  return apiCall('Get Sync History', async () => {
    const response = await apiClient.get('/sync/history');
    return response.data.data;
  });
}

export async function getSyncCasesHistory(): Promise<SyncHistoryEntry[]> {
  return apiCall('Get Sync Cases History', async () => {
    const response = await apiClient.get('/sync/cases/history');
    return response.data.data;
  });
}

export async function getAutoSyncConfig(): Promise<AutoSyncConfig> {
  return apiCall('Get Auto-Sync Config', async () => {
    const response = await apiClient.get('/sync/auto-config');
    return mapSnakeToCamel(response.data.data) as AutoSyncConfig;
  });
}

export async function updateAutoSyncConfig(patch: Partial<AutoSyncConfig>): Promise<AutoSyncConfig> {
  return apiCall('Update Auto-Sync Config', async () => {
    const response = await apiClient.put('/sync/auto-config', mapCamelToSnake(patch));
    return mapSnakeToCamel(response.data.data) as AutoSyncConfig;
  });
}
