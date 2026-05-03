import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSaveNotificationSettings, useTestNotificationWebhook } from './useNotifications';

const mockInvalidateSettings = vi.fn();
const mockMutateAsyncSave = vi.fn();
const mockMutateAsyncTest = vi.fn();

function createMutationHook(mutateAsync: any, options?: any) {
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
      notifications: {
        settings: {
          invalidate: mockInvalidateSettings,
        },
      },
    }),
    notifications: {
      saveSettings: {
        useMutation: (options: any) => createMutationHook(mockMutateAsyncSave, options),
      },
      testWebhook: {
        useMutation: () => createMutationHook(mockMutateAsyncTest),
      },
    },
  },
}));

describe('useNotifications mutations', () => {
  it('saveSettings invalidates settings on success', async () => {
    mockMutateAsyncSave.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useSaveNotificationSettings());
    await result.current.mutateAsync({ email: 'a@b.com' });
    expect(mockInvalidateSettings).toHaveBeenCalled();
  });

  it('testWebhook calls mutateAsync', async () => {
    mockMutateAsyncTest.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useTestNotificationWebhook());
    await result.current.mutateAsync({ channel: 'slack', url: 'https://hooks.slack.com/test' });
    expect(mockMutateAsyncTest).toHaveBeenCalledWith({ channel: 'slack', url: 'https://hooks.slack.com/test' });
  });
});
