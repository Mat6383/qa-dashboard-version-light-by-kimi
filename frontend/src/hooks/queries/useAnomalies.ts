import { trpc } from '../../trpc/client';
import { useAuth } from '../useAuth';
import type { AnomalyItem } from '../../types/api.types';

/**
 * Hook tRPC pour récupérer les anomalies d'un projet.
 * @param projectId - ID du projet
 */
export function useAnomalies(projectId: number | null) {
  const { isAuthenticated } = useAuth();
  const { data, ...rest } = trpc.anomalies.list.useQuery(
    projectId ? { projectId } : undefined,
    {
      enabled: !!projectId && isAuthenticated,
      staleTime: 2 * 60 * 1000,
    }
  );
  return {
    data: (data?.data ?? []) as AnomalyItem[],
    ...rest,
  };
}
