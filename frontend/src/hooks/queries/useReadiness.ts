import { useQuery } from '@tanstack/react-query';
import { getReadiness } from '../../services/api/dashboard';
import type { ReadinessResult } from '../../types/api.types';

export function useReadiness(
  projectId: number | null,
  preprodMilestones: number[] | null = null,
  prodMilestones: number[] | null = null,
  enabled = true
) {
  return useQuery<ReadinessResult>({
    queryKey: ['readiness', projectId, preprodMilestones, prodMilestones],
    queryFn: () => getReadiness(projectId!, preprodMilestones, prodMilestones),
    enabled: !!projectId && enabled,
    staleTime: 2 * 60 * 1000,
  });
}
