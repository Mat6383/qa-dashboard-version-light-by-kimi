import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMultiProjectSummary } from './useMultiProjectSummary';

const mockUseQuery = vi.fn();

vi.mock('../../trpc/client', () => ({
  trpc: {
    dashboard: {
      multiProjectSummary: {
        useQuery: (_input: any, options: any) => mockUseQuery(_input, options),
      },
    },
  },
}));

describe('useMultiProjectSummary', () => {
  it('returns multi-project summary', () => {
    mockUseQuery.mockReturnValue({
      data: { data: [{ projectId: 1, projectName: 'Alpha', passRate: 92.5 }] },
      isLoading: false,
    });
    const { result } = renderHook(() => useMultiProjectSummary());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].projectName).toBe('Alpha');
  });

  it('returns empty array when no data', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useMultiProjectSummary());
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});
