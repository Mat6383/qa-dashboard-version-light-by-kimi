import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api.service';
import type { MultiProjectSummaryItem } from '../../types/api.types';

export const MULTI_PROJECT_SUMMARY_KEY = ['multi-project-summary'] as const;

/**
 * Hook REST pour la synthèse multi-projets.
 * Le backend retourne { projects, metrics } ; on expose metrics directement.
 */
export function useMultiProjectSummary() {
  return useQuery({
    queryKey: MULTI_PROJECT_SUMMARY_KEY,
    queryFn: async () => {
      const res = await apiService.getMultiProjectSummary();
      // Le backend retourne { projects: [...], metrics: [...] }
      const metrics = (res as any)?.metrics ?? (res as any)?.data ?? [];
      return metrics as MultiProjectSummaryItem[];
    },
    staleTime: 2 * 60 * 1000,
  });
}
