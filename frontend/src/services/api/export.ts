/**
 * Export (PDF, CSV, Excel) API methods
 */

import { apiClient, apiCall, ExportMilestones } from './core';

export async function generateBackendPDF(
  projectId: number,
  milestones: ExportMilestones,
  format = 'A4',
  darkMode = false,
  lang?: string
): Promise<Blob> {
  return apiCall('Generate Backend PDF', async () => {
    const response = await apiClient.post(
      '/pdf/generate',
      { projectId, milestones, format, darkMode, lang },
      { responseType: 'blob', timeout: 120000 }
    );
    return response.data;
  });
}

export async function generateCSV(projectId: number, milestones: ExportMilestones, lang?: string): Promise<Blob> {
  return apiCall('Generate CSV', async () => {
    const response = await apiClient.post(
      '/export/csv',
      { projectId, milestones, lang },
      { responseType: 'blob', timeout: 60000 }
    );
    return response.data;
  });
}

export async function generateExcel(projectId: number, milestones: ExportMilestones, lang?: string): Promise<Blob> {
  return apiCall('Generate Excel', async () => {
    const response = await apiClient.post(
      '/export/excel',
      { projectId, milestones, lang },
      { responseType: 'blob', timeout: 60000 }
    );
    return response.data;
  });
}
