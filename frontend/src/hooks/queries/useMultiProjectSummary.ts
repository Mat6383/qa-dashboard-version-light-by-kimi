import { trpc } from '../../trpc/client';
import type { MultiProjectSummaryItem } from '../../types/api.types';

export const MULTI_PROJECT_SUMMARY_KEY = ['multi-project-summary'] as const;

/**
 * Hook tRPC pour la synthèse multi-projets.
 */
export function useMultiProjectSummary() {
  const { data, ...rest } = trpc.dashboard.multiProjectSummary.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });
  return {
    data: (data?.data ?? []) as MultiProjectSummaryItem[],
    ...rest,
  };
}
