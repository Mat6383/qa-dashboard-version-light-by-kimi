import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjects } from './useProjects';

const mockUseQuery = vi.fn();

vi.mock('../../trpc/client', () => ({
  trpc: {
    projects: {
      list: {
        useQuery: (_input: any, options: any) => mockUseQuery(_input, options),
      },
    },
  },
}));

describe('useProjects', () => {
  it('returns projects list', () => {
    mockUseQuery.mockReturnValue({
      data: { data: { result: [{ id: 1, name: 'Alpha' }] } },
      isLoading: false,
    });
    const { result } = renderHook(() => useProjects());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].name).toBe('Alpha');
  });

  it('returns empty array when no data', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useProjects());
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});
