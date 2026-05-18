import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api.service';
import type { DashboardMetrics, QualityRates } from '../../types/api.types';

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

  const metricsQuery = useQuery({
    queryKey: ['dashboard-metrics', projectId, preprodMilestones, prodMilestones],
    queryFn: () => apiService.getDashboardMetrics(projectId!, preprodMilestones, prodMilestones),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: autoRefresh && !liveConnected ? 60000 : false,
  });

  const qualityQuery = useQuery({
    queryKey: ['dashboard-qualityRates', projectId, preprodMilestones, prodMilestones],
    queryFn: () => apiService.getQualityRates(projectId!, preprodMilestones, prodMilestones),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: autoRefresh && !liveConnected ? 60000 : false,
  });

  const isLoading = metricsQuery.isLoading || qualityQuery.isLoading;
  const isError = metricsQuery.isError || qualityQuery.isError;
  const error = metricsQuery.error || qualityQuery.error;

  // NOTE: these REST endpoints return raw data, not ApiResponse wrappers
  const metricsData = (metricsQuery.data as unknown as DashboardMetrics) || undefined;
  const qualityRates = (qualityQuery.data as unknown as QualityRates) || undefined;

  const data: DashboardMetrics | undefined =
    metricsData && qualityRates
      ? { ...metricsData, qualityRates }
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
