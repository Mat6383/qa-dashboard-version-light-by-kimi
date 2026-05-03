import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCircuitBreakers } from './useCircuitBreakers';

const mockUseQuery = vi.fn();

vi.mock('../../trpc/client', () => ({
  trpc: {
    anomalies: {
      circuitBreakers: {
        useQuery: (_input: any, options: any) => mockUseQuery(_input, options),
      },
    },
  },
}));

describe('useCircuitBreakers', () => {
  it('returns circuit breaker states', () => {
    mockUseQuery.mockReturnValue({
      data: { data: [{ name: 'testmo', state: 'CLOSED' }] },
      isLoading: false,
    });
    const { result } = renderHook(() => useCircuitBreakers());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].state).toBe('CLOSED');
  });

  it('enables auto refresh when requested', () => {
    mockUseQuery.mockReturnValue({ data: { data: [] }, isLoading: false });
    renderHook(() => useCircuitBreakers({ autoRefresh: true }));
    expect(mockUseQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ refetchInterval: 30000 }));
  });
});
