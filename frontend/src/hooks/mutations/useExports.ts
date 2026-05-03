import { useMutation } from '@tanstack/react-query';
import apiService from '../../services/api.service';
import type { ExportMilestones } from '../../services/api.service';

export function useGenerateBackendPDF() {
  return useMutation({
    mutationFn: (params: { projectId: number; milestones: ExportMilestones; format?: string; darkMode?: boolean; lang?: string }) =>
      apiService.generateBackendPDF(params.projectId, params.milestones, params.format, params.darkMode, params.lang),
  });
}

export function useGenerateCSV() {
  return useMutation({
    mutationFn: (params: { projectId: number; milestones: ExportMilestones; lang?: string }) =>
      apiService.generateCSV(params.projectId, params.milestones, params.lang),
  });
}

export function useGenerateExcel() {
  return useMutation({
    mutationFn: (params: { projectId: number; milestones: ExportMilestones; lang?: string }) =>
      apiService.generateExcel(params.projectId, params.milestones, params.lang),
  });
}
