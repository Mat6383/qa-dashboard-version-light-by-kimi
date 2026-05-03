import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCreateFeatureFlag, useUpdateFeatureFlag, useDeleteFeatureFlag } from './useFeatureFlags';

const mockInvalidateListAdmin = vi.fn();
const mockInvalidateList = vi.fn();
const mockMutateAsyncCreate = vi.fn();
const mockMutateAsyncUpdate = vi.fn();
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
      featureFlags: {
        listAdmin: { invalidate: mockInvalidateListAdmin },
        list: { invalidate: mockInvalidateList },
      },
    }),
    featureFlags: {
      create: {
        useMutation: (options: any) => createMutationHook(mockMutateAsyncCreate, options),
      },
      update: {
        useMutation: (options: any) => createMutationHook(mockMutateAsyncUpdate, options),
      },
      delete: {
        useMutation: (options: any) => createMutationHook(mockMutateAsyncDelete, options),
      },
    },
  },
}));

describe('useFeatureFlags mutations', () => {
  it('create invalidates lists on success', async () => {
    mockMutateAsyncCreate.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useCreateFeatureFlag());
    await result.current.mutateAsync({ key: 'newFlag', enabled: true });
    expect(mockInvalidateListAdmin).toHaveBeenCalled();
    expect(mockInvalidateList).toHaveBeenCalled();
  });

  it('update invalidates lists on success', async () => {
    mockMutateAsyncUpdate.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useUpdateFeatureFlag());
    await result.current.mutateAsync({ key: 'newFlag', enabled: false });
    expect(mockInvalidateListAdmin).toHaveBeenCalled();
    expect(mockInvalidateList).toHaveBeenCalled();
  });

  it('delete invalidates lists on success', async () => {
    mockMutateAsyncDelete.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useDeleteFeatureFlag());
    await result.current.mutateAsync({ key: 'newFlag' });
    expect(mockInvalidateListAdmin).toHaveBeenCalled();
    expect(mockInvalidateList).toHaveBeenCalled();
  });
});
