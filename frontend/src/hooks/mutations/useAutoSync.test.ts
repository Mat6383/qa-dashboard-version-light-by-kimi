import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUpdateAutoSyncConfig } from './useAutoSync';

const mockInvalidate = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('../../trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      sync: {
        autoConfig: {
          invalidate: mockInvalidate,
        },
      },
    }),
    sync: {
      updateAutoConfig: {
        useMutation: (options: any) => {
          return {
            mutateAsync: (...args: any[]) => {
              const result = mockMutateAsync(...args);
              if (options?.onSuccess) {
                Promise.resolve(result).then(() => options.onSuccess());
              }
              return result;
            },
            isPending: false,
          };
        },
      },
    },
  },
}));

describe('useUpdateAutoSyncConfig', () => {
  it('invalidates autoConfig query on success', async () => {
    mockMutateAsync.mockResolvedValue({ enabled: true });
    const { result } = renderHook(() => useUpdateAutoSyncConfig());
    await result.current.mutateAsync({ enabled: true });
    expect(mockMutateAsync).toHaveBeenCalledWith({ enabled: true });
    expect(mockInvalidate).toHaveBeenCalled();
  });
});
