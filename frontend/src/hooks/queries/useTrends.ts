import { useQuery } from '@tanstack/react-query';
import { getTrends } from '../../services/api/dashboard';

export function useTrends(
  projectId: number | null | undefined,
  granularity: string,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: ['trends', projectId, granularity, from, to],
    queryFn: async () => {
      if (!projectId) return { project_id: 0, granularity, snapshots: [] };
      return getTrends(projectId, granularity, from, to);
    },
    enabled: !!projectId && !!from && !!to,
    staleTime: 60 * 1000,
  });
}
