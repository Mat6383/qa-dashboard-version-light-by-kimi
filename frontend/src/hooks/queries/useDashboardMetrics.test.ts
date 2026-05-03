import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDashboardMetrics } from './useDashboardMetrics';

const mockMetricsQuery = vi.fn();
const mockQualityQuery = vi.fn();

vi.mock('../../trpc/client', () => ({
  trpc: {
    dashboard: {
      metrics: {
        useQuery: (input: any, options: any) => mockMetricsQuery(input, options),
      },
      qualityRates: {
        useQuery: (input: any, options: any) => mockQualityQuery(input, options),
      },
    },
  },
}));

describe('useDashboardMetrics', () => {
  it('returns combined metrics and quality rates', () => {
    mockMetricsQuery.mockReturnValue({
      data: { data: { passRate: 95, completionRate: 80 } },
      isLoading: false,
      isError: false,
      error: null,
      dataUpdatedAt: Date.now(),
      refetch: vi.fn(),
    });
    mockQualityQuery.mockReturnValue({
      data: { data: { escapeRate: 3, detectionRate: 97 } },
      isLoading: false,
      isError: false,
      error: null,
      dataUpdatedAt: Date.now(),
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useDashboardMetrics(1, [10], [20]));
    expect(result.current.data).toBeDefined();
    expect(result.current.data!.passRate).toBe(95);
    expect(result.current.data!.qualityRates.escapeRate).toBe(3);
    expect(result.current.isLoading).toBe(false);
  });

  it('is disabled when projectId is null', () => {
    mockMetricsQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null, dataUpdatedAt: 0, refetch: vi.fn() });
    mockQualityQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null, dataUpdatedAt: 0, refetch: vi.fn() });

    renderHook(() => useDashboardMetrics(null));
    expect(mockMetricsQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false }));
    expect(mockQualityQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false }));
  });
});
