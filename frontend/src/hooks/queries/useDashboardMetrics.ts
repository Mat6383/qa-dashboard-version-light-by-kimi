import { trpc } from '../../trpc/client';
import type { DashboardMetrics } from '../../types/api.types';

export interface UseDashboardMetricsOptions {
  autoRefresh?: boolean;
  liveConnected?: boolean;
}

export function useDashboardMetrics(
  projectId: number | null,
  preprodMilestones: number[] | null = null,
  prodMilestones: number[] | null = null,
  options: UseDashboardMetricsOptions = {}
) {
  const { autoRefresh = false, liveConnected = false } = options;

  const metricsQuery = trpc.dashboard.metrics.useQuery(
    projectId ? { projectId, preprodMilestones: preprodMilestones || undefined, prodMilestones: prodMilestones || undefined } : undefined,
    {
      enabled: !!projectId,
      staleTime: 2 * 60 * 1000,
      refetchInterval: autoRefresh && !liveConnected ? 60000 : false,
    }
  );

  const qualityQuery = trpc.dashboard.qualityRates.useQuery(
    projectId ? { projectId, preprodMilestones: preprodMilestones || undefined, prodMilestones: prodMilestones || undefined } : undefined,
    {
      enabled: !!projectId,
      staleTime: 2 * 60 * 1000,
      refetchInterval: autoRefresh && !liveConnected ? 60000 : false,
    }
  );

  const isLoading = metricsQuery.isLoading || qualityQuery.isLoading;
  const isError = metricsQuery.isError || qualityQuery.isError;
  const error = metricsQuery.error || qualityQuery.error;

  const data: DashboardMetrics | undefined =
    metricsQuery.data && qualityQuery.data
      ? {
          ...(metricsQuery.data.data as any),
          qualityRates: qualityQuery.data.data,
        }
      : undefined;

  return {
    data,
    isLoading,
    isError,
    error,
    dataUpdatedAt: metricsQuery.dataUpdatedAt,
    refetch: () => {
      metricsQuery.refetch();
      qualityQuery.refetch();
    },
  };
}
