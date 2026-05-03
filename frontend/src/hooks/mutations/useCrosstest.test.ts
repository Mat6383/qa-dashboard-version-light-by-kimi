import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSaveCrosstestComment, useDeleteCrosstestComment } from './useCrosstest';

const mockInvalidateComments = vi.fn();
const mockMutateAsyncSave = vi.fn();
const mockMutateAsyncDelete = vi.fn();

function createMutationHook(mutateAsync: any, options: any) {
  return {
    mutateAsync: (...args: any[]) => {
      const result = mutateAsync(...args);
      if (options?.onSuccess) {
        Promise.resolve(result).then(() => options.onSuccess());
      }
      return result;
    },
    isPending: false,
  };
}

vi.mock('../../trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      crosstest: {
        comments: {
          invalidate: mockInvalidateComments,
        },
      },
    }),
    crosstest: {
      saveComment: {
        useMutation: (options: any) => createMutationHook(mockMutateAsyncSave, options),
      },
      deleteComment: {
        useMutation: (options: any) => createMutationHook(mockMutateAsyncDelete, options),
      },
    },
  },
}));

describe('useCrosstest mutations', () => {
  it('saveComment invalidates comments on success', async () => {
    mockMutateAsyncSave.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useSaveCrosstestComment());
    await result.current.mutateAsync({ iid: 1, comment: 'OK' });
    expect(mockInvalidateComments).toHaveBeenCalled();
  });

  it('deleteComment invalidates comments on success', async () => {
    mockMutateAsyncDelete.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useDeleteCrosstestComment());
    await result.current.mutateAsync({ iid: 1 });
    expect(mockInvalidateComments).toHaveBeenCalled();
  });
});
