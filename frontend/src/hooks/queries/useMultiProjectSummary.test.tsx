import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMultiProjectSummary } from './useMultiProjectSummary';

const mockGetMultiProjectSummary = vi.fn();

vi.mock('../../services/api.service', () => ({
  default: {
    getMultiProjectSummary: () => mockGetMultiProjectSummary(),
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

describe('useMultiProjectSummary', () => {
  it('returns multi-project summary', async () => {
    mockGetMultiProjectSummary.mockResolvedValue({
      data: [{ projectId: 1, projectName: 'Alpha', passRate: 92.5 }],
    });

    const { result } = renderHook(() => useMultiProjectSummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].projectName).toBe('Alpha');
  });

  it('returns empty array when no data', async () => {
    mockGetMultiProjectSummary.mockResolvedValue({ data: undefined });

    const { result } = renderHook(() => useMultiProjectSummary(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
  });
});
