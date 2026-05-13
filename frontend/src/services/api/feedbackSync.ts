/**
 * Feedback Sync API methods
 */

import type { FeedbackSyncRun, FeedbackSyncConfig } from '../../types/api.types';
import { apiClient, apiCall } from './core';

export async function runFeedbackScan(projectId: number, activeOnly = true): Promise<FeedbackSyncRun> {
  return apiCall('Run Feedback Sync', async () => {
    const response = await apiClient.post('/feedback-sync/run', {
      project_id: projectId,
      active_only: activeOnly,
    });
    return response.data.data;
  });
}

export async function getFeedbackSyncHistory(limit = 50): Promise<FeedbackSyncRun[]> {
  return apiCall('Get Feedback Sync History', async () => {
    const response = await apiClient.get('/feedback-sync/history', { params: { limit } });
    return response.data.data;
  });
}

export async function getFeedbackSyncConfig(): Promise<FeedbackSyncConfig> {
  return apiCall('Get Feedback Sync Config', async () => {
    const response = await apiClient.get('/feedback-sync/config');
    return response.data.data;
  });
}
