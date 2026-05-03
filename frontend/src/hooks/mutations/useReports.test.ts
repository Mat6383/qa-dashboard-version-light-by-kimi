import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGenerateReport } from './useReports';

const mockMutateAsync = vi.fn();

vi.mock('../../trpc/client', () => ({
  trpc: {
    reports: {
      generate: {
        useMutation: () => ({
          mutateAsync: mockMutateAsync,
          isPending: false,
        }),
      },
    },
  },
}));

describe('useGenerateReport', () => {
  it('calls generate mutation', async () => {
    mockMutateAsync.mockResolvedValue({ files: { html: 'base64' } });
    const { result } = renderHook(() => useGenerateReport());
    const params = { projectId: 1, runIds: [10], formats: { html: true } };
    await result.current.mutateAsync(params as any);
    expect(mockMutateAsync).toHaveBeenCalledWith(params);
  });
});
