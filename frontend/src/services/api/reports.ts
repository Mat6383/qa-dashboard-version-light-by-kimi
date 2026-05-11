/**
 * Reports API methods
 */

import type { ApiResponse } from '../../types/api.types';
import { apiClient, apiCall, ReportGenerateParams } from './core';

export async function generateReport(params: ReportGenerateParams): Promise<ApiResponse<unknown>> {
  return apiCall('Generate Report', async () => {
    const response = await apiClient.post('/reports/generate', params, { timeout: 120000 });
    return response.data;
  });
}
