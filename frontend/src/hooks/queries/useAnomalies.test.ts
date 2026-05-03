import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnomalies } from './useAnomalies';

const mockUseQuery = vi.fn();

vi.mock('../../trpc/client', () => ({
  trpc: {
    anomalies: {
      list: {
        useQuery: (_input: any, options: any) => mockUseQuery(_input, options),
      },
    },
  },
}));

describe('useAnomalies', () => {
  it('returns anomalies when projectId provided', () => {
    mockUseQuery.mockReturnValue({
      data: { data: [{ metric: 'pass_rate', severity: 'critical' }] },
      isLoading: false,
    });
    const { result } = renderHook(() => useAnomalies(1));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].severity).toBe('critical');
  });

  it('returns empty array when projectId is null', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { result } = renderHook(() => useAnomalies(null));
    expect(result.current.data).toEqual([]);
  });
});
