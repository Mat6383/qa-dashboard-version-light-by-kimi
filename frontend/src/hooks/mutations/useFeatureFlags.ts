import { trpc } from '../../trpc/client';
import type { FeatureFlagCreateInput, FeatureFlagUpdateInput } from '../../types/api.types';

export function useCreateFeatureFlag() {
  const utils = trpc.useUtils();
  return trpc.featureFlags.create.useMutation({
    onSuccess: () => {
      utils.featureFlags.listAdmin.invalidate();
      utils.featureFlags.list.invalidate();
    },
  });
}

export function useUpdateFeatureFlag() {
  const utils = trpc.useUtils();
  return trpc.featureFlags.update.useMutation({
    onSuccess: () => {
      utils.featureFlags.listAdmin.invalidate();
      utils.featureFlags.list.invalidate();
    },
  });
}

export function useDeleteFeatureFlag() {
  const utils = trpc.useUtils();
  return trpc.featureFlags.delete.useMutation({
    onSuccess: () => {
      utils.featureFlags.listAdmin.invalidate();
      utils.featureFlags.list.invalidate();
    },
  });
}
