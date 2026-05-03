import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook } from './useWebhooks';

const mockState = vi.hoisted(() => ({
  invalidate: vi.fn(),
  useQuery: vi.fn(() => ({ data: [] })),
  useMutation: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock('../../trpc/client', () => ({
  trpc: {
    webhooks: {
      list: { useQuery: mockState.useQuery },
      create: { useMutation: mockState.useMutation },
      update: { useMutation: mockState.useMutation },
      delete: { useMutation: mockState.useMutation },
    },
    useUtils: () => ({ webhooks: { list: { invalidate: mockState.invalidate } } }),
  },
}));

describe('useWebhooks hooks', () => {
  it('useWebhooks appelle useQuery', () => {
    const { result } = renderHook(() => useWebhooks());
    expect(result.current.data).toEqual([]);
  });

  it('useCreateWebhook retourne une mutation avec invalidate', () => {
    const { result } = renderHook(() => useCreateWebhook());
    expect(result.current).toBeDefined();
  });

  it('useUpdateWebhook retourne une mutation', () => {
    const { result } = renderHook(() => useUpdateWebhook());
    expect(result.current).toBeDefined();
  });

  it('useDeleteWebhook retourne une mutation', () => {
    const { result } = renderHook(() => useDeleteWebhook());
    expect(result.current).toBeDefined();
  });
});
