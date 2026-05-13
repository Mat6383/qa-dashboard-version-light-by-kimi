/**
 * Feedback Sync API methods
 */

import type { FeedbackSyncRun, FeedbackSyncConfig } from '../../types/api.types';
import { apiClient, apiCall, mapSnakeToCamel } from './core';

function mapFeedbackSyncRun(row: Record<string, any>): FeedbackSyncRun {
  return {
    ...mapSnakeToCamel(row),
    details: (row.details || []).map(mapSnakeToCamel),
  } as FeedbackSyncRun;
}

export async function runFeedbackScan(projectId: number, activeOnly = true): Promise<FeedbackSyncRun> {
  return apiCall('Run Feedback Sync', async () => {
    const response = await apiClient.post('/feedback-sync/run', {
      project_id: projectId,
      active_only: activeOnly,
    });
    return mapFeedbackSyncRun(response.data.data);
  });
}

export async function getFeedbackSyncHistory(limit = 50): Promise<FeedbackSyncRun[]> {
  return apiCall('Get Feedback Sync History', async () => {
    const response = await apiClient.get('/feedback-sync/history', { params: { limit } });
    const rows = response.data.data as Record<string, any>[];
    return rows.map(mapFeedbackSyncRun);
  });
}

export async function getFeedbackSyncConfig(): Promise<FeedbackSyncConfig> {
  return apiCall('Get Feedback Sync Config', async () => {
    const response = await apiClient.get('/feedback-sync/config');
    return mapSnakeToCamel(response.data.data) as FeedbackSyncConfig;
  });
}
