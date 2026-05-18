import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCircuitBreakers } from './useCircuitBreakers';

const mockGetCircuitBreakers = vi.fn();

vi.mock('../../services/api.service', () => ({
  default: {
    getCircuitBreakers: () => mockGetCircuitBreakers(),
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

describe('useCircuitBreakers', () => {
  it('returns circuit breaker states', async () => {
    mockGetCircuitBreakers.mockResolvedValue({
      data: [{ name: 'testmo', state: 'CLOSED' }],
    });

    const { result } = renderHook(() => useCircuitBreakers(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].state).toBe('CLOSED');
  });

  it('enables auto refresh when requested', async () => {
    mockGetCircuitBreakers.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useCircuitBreakers({ autoRefresh: true }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
});
