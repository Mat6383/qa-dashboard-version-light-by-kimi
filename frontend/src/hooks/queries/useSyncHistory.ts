import { useQuery } from '@tanstack/react-query';
import { getSyncHistory } from '../../services/api/sync';

export function useSyncHistory(enabled = true) {
  return useQuery({
    queryKey: ['sync-history'],
    queryFn: () => getSyncHistory(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
