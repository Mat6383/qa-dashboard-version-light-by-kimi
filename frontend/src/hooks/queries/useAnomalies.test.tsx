import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAnomalies } from './useAnomalies';

const mockGetAnomalies = vi.fn();

vi.mock('../../services/api.service', () => ({
  default: {
    getAnomalies: (projectId: number) => mockGetAnomalies(projectId),
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

describe('useAnomalies', () => {
  it('returns anomalies when projectId provided', async () => {
    mockGetAnomalies.mockResolvedValue({
      data: [{ metric: 'pass_rate', severity: 'critical' }],
    });

    const { result } = renderHook(() => useAnomalies(1), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].severity).toBe('critical');
  });

  it('returns empty array when projectId is null', () => {
    const { result } = renderHook(() => useAnomalies(null), { wrapper: Wrapper });
    expect(result.current.data).toEqual([]);
  });
});
