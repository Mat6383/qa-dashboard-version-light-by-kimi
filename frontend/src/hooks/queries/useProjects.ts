import { trpc } from '../../trpc/client';
import type { Project } from '../../types/api.types';

export const PROJECTS_QUERY_KEY = ['projects'] as const;

/**
 * Hook tRPC pour récupérer la liste des projets.
 * Cache : 5 min stale.
 */
export function useProjects() {
  const { data, ...rest } = trpc.projects.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Robustesse : le backend Node legacy peut renvoyer { result: { result: [...] } }
  // ou le backend Python renvoie directement le tableau dans data.data
  const raw = data?.data?.result ?? data?.data ?? [];
  const projects = Array.isArray(raw) ? raw : (raw as any)?.result ?? [];

  return {
    data: projects as Project[],
    ...rest,
  };
}
