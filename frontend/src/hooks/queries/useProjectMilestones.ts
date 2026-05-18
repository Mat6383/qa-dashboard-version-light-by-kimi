import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api.service';
import type { Milestone } from '../../types/api.types';

export function useProjectMilestones(projectId: number | null) {
  return useQuery({
    queryKey: ['project-milestones', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await apiService.getProjectMilestones(projectId);
      return (res.result || []) as Milestone[];
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}
