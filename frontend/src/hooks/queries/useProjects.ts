import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api.service';
import type { Project } from '../../types/api.types';

export const PROJECTS_QUERY_KEY = ['projects'] as const;

/**
 * Hook REST pour récupérer la liste des projets.
 * Cache : 5 min stale.
 */
export function useProjects() {
  const { data, ...rest } = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => apiService.getProjects(),
    staleTime: 5 * 60 * 1000,
  });

  const raw = (data as any)?.projects ?? (data as any)?.data?.result ?? (data as any)?.data ?? [];
  const projects = Array.isArray(raw) ? raw : (raw as any)?.result ?? [];

  return {
    data: projects as Project[],
    ...rest,
  };
}
