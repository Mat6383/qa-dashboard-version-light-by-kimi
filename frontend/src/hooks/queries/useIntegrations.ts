import { trpc } from '../../trpc/client';
import type { Integration } from '../../types/api.types';

export type { Integration };

export function useIntegrations() {
  return trpc.integrations.list.useQuery(undefined, { staleTime: 60 * 1000 });
}
