import { trpc } from '../../trpc/client';

export function useUpdateAutoSyncConfig() {
  const utils = trpc.useUtils();
  return trpc.sync.updateAutoConfig.useMutation({
    onSuccess: () => {
      utils.sync.autoConfig.invalidate();
    },
  });
}
