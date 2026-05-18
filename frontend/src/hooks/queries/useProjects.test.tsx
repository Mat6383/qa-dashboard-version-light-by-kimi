import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useProjects } from './useProjects';

const mockGetProjects = vi.fn();

vi.mock('../../services/api.service', () => ({
  default: {
    getProjects: () => mockGetProjects(),
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

describe('useProjects', () => {
  it('returns projects list', async () => {
    mockGetProjects.mockResolvedValue({
      data: { result: [{ id: 1, name: 'Alpha' }] },
    });

    const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].name).toBe('Alpha');
  });

  it('returns empty array when no data', async () => {
    mockGetProjects.mockResolvedValue({ data: undefined });

    const { result } = renderHook(() => useProjects(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
  });
});
