/**
 * Crosstest API methods
 */

import type {
  SyncIteration,
  CrosstestIssue,
  CrosstestComment,
} from '../../types/api.types';
import { apiClient, apiCall } from './core';

export async function getCrosstestIterations(search = ''): Promise<SyncIteration[]> {
  return apiCall('Get Crosstest Iterations', async () => {
    const response = await apiClient.get('/crosstest/iterations', {
      params: search ? { search } : {},
    });
    return response.data.data;
  });
}

export async function getCrosstestIssues(iterationId: number): Promise<CrosstestIssue[]> {
  return apiCall('Get Crosstest Issues', async () => {
    const response = await apiClient.get(`/crosstest/issues/${iterationId}`);
    return response.data.data;
  });
}

export async function getCrosstestComments(): Promise<Record<number, CrosstestComment>> {
  return apiCall('Get Crosstest Comments', async () => {
    const response = await apiClient.get('/crosstest/comments');
    return response.data.data;
  });
}

export async function saveCrosstestComment(
  iid: number,
  comment: string,
  milestoneContext: string | null = null
): Promise<CrosstestComment> {
  return apiCall('Save Crosstest Comment', async () => {
    const response = await apiClient.post('/crosstest/comments', {
      issue_iid: iid,
      comment,
      milestone_context: milestoneContext,
    });
    return response.data.data;
  });
}

export async function deleteCrosstestComment(iid: number): Promise<boolean> {
  return apiCall('Delete Crosstest Comment', async () => {
    const response = await apiClient.delete(`/crosstest/comments/${iid}`);
    return response.data.deleted;
  });
}
