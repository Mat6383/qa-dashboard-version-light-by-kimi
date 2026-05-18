import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api.service';
import type { AnomalyItem } from '../../types/api.types';

/**
 * Hook REST pour récupérer les anomalies d'un projet.
 * @param projectId - ID du projet
 */
export function useAnomalies(projectId: number | null) {
  const { data, ...rest } = useQuery({
    queryKey: ['anomalies', projectId],
    queryFn: () => apiService.getAnomalies(projectId!),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
  });

  const raw = (data as any)?.anomalies ?? (data as any)?.data ?? [];
  return {
    data: (Array.isArray(raw) ? raw : []) as AnomalyItem[],
    ...rest,
  };
}
