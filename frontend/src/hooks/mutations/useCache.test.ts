import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClearCache } from './useCache';

const mockInvalidate = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('../../trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      invalidate: mockInvalidate,
    }),
    cache: {
      clear: {
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

describe('useClearCache', () => {
  it('invalidates all queries on success', async () => {
    mockMutateAsync.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useClearCache());
    await result.current.mutateAsync();
    expect(mockInvalidate).toHaveBeenCalled();
  });
});
