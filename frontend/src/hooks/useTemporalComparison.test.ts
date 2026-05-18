import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useTemporalComparison } from './useTemporalComparison';

const mockGet = vi.fn();

vi.mock('../services/api.service', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('useTemporalComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const snapshots = [
    { date: '2026-05-11', pass_rate: 80, completion_rate: 90, escape_rate: 5, detection_rate: 95, blocked_rate: 2, total_tests: 100 },
    { date: '2026-05-04', pass_rate: 75, completion_rate: 85, escape_rate: 6, detection_rate: 94, blocked_rate: 3, total_tests: 90 },
    { date: '2026-04-18', pass_rate: 70, completion_rate: 80, escape_rate: 7, detection_rate: 93, blocked_rate: 4, total_tests: 80 },
  ];

  it('returns loading initially and fetches data', async () => {
    mockGet.mockResolvedValue({ data: { snapshots } });
    const { result } = renderHook(() => useTemporalComparison(1), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/dashboard/1/trends', {
      params: { granularity: 'day', from: '2026-04-13', to: '2026-05-18' },
    });
  });

  it('computes deltas correctly via getTemporalForMetric', async () => {
    mockGet.mockResolvedValue({ data: { snapshots } });
    const { result } = renderHook(() => useTemporalComparison(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const temp = result.current.getTemporalForMetric('passRate', 85);
    expect(temp).not.toBeNull();
    expect(temp?.current).toBe(85);
    expect(temp?.delta7).toBe(5); // 85 - 80
    expect(temp?.delta14).toBe(10); // 85 - 75
    expect(temp?.delta30).toBe(15); // 85 - 70
  });

  it('returns null deltas when no historical data exists', async () => {
    mockGet.mockResolvedValue({ data: { snapshots: [] } });
    const { result } = renderHook(() => useTemporalComparison(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const temp = result.current.getTemporalForMetric('passRate', 85);
    expect(temp).toBeNull();
  });

  it('computes delta when previous is 0 (U045 fix)', async () => {
    const zeroSnapshots = [
      { date: '2026-05-11', pass_rate: 0, completion_rate: 0, escape_rate: 0, detection_rate: 0, blocked_rate: 0, total_tests: 0 },
    ];
    mockGet.mockResolvedValue({ data: { snapshots: zeroSnapshots } });
    const { result } = renderHook(() => useTemporalComparison(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const temp = result.current.getTemporalForMetric('passRate', 5);
    expect(temp?.delta7).toBe(5);
  });

  it('maps failureRate to blocked_rate for deltas (U042 fix)', async () => {
    const blockedSnapshots = [
      { date: '2026-05-11', pass_rate: 80, completion_rate: 90, escape_rate: 5, detection_rate: 95, blocked_rate: 10, total_tests: 100 },
    ];
    mockGet.mockResolvedValue({ data: { snapshots: blockedSnapshots } });
    const { result } = renderHook(() => useTemporalComparison(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const temp = result.current.getTemporalForMetric('failureRate', 15);
    expect(temp).not.toBeNull();
    expect(temp?.delta7).toBe(5); // 15 - 10
  });

  it('does not fetch when projectId is null', async () => {
    const { result } = renderHook(() => useTemporalComparison(null), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useTemporalComparison(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getTemporalForMetric('passRate', 50)).toBeNull();
  });
});
