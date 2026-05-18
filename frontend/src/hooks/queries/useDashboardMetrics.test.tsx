import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useDashboardMetrics } from './useDashboardMetrics';

const mockGetDashboardMetrics = vi.fn();
const mockGetQualityRates = vi.fn();

vi.mock('../../services/api.service', () => ({
  default: {
    getDashboardMetrics: (projectId: number, preprod: any, prod: any) =>
      mockGetDashboardMetrics(projectId, preprod, prod),
    getQualityRates: (projectId: number, preprod: any, prod: any) =>
      mockGetQualityRates(projectId, preprod, prod),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

describe('useDashboardMetrics', () => {
  it('returns combined metrics and quality rates', async () => {
    mockGetDashboardMetrics.mockResolvedValue({
      passRate: 95,
      completionRate: 80,
    });
    mockGetQualityRates.mockResolvedValue({
      escapeRate: 3,
      detectionRate: 97,
    });

    const { result } = renderHook(() => useDashboardMetrics(1, [10], [20]), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.passRate).toBe(95);
    expect(result.current.data!.qualityRates.escapeRate).toBe(3);
    expect(result.current.isLoading).toBe(false);
  });

  it('is disabled when projectId is null', () => {
    mockGetDashboardMetrics.mockResolvedValue(undefined);
    mockGetQualityRates.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDashboardMetrics(null), { wrapper: Wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});
