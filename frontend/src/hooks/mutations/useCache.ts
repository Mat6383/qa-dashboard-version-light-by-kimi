import { trpc } from '../../trpc/client';

export function useClearCache() {
  const utils = trpc.useUtils();
  return trpc.cache.clear.useMutation({
    onSuccess: () => {
      utils.invalidate();
    },
  });
}
