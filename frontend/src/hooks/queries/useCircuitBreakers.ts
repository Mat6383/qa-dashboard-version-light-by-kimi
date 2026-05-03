import { trpc } from '../../trpc/client';
import type { CircuitBreakerState } from '../../types/api.types';

export const CIRCUIT_BREAKERS_KEY = ['circuit-breakers'] as const;

/**
 * Hook tRPC pour récupérer l'état des circuit breakers.
 * @param options - Configuration optionnelle
 */
export function useCircuitBreakers({ autoRefresh = false }: { autoRefresh?: boolean } = {}) {
  const { data, ...rest } = trpc.anomalies.circuitBreakers.useQuery(undefined, {
    staleTime: 30 * 1000,
    refetchInterval: autoRefresh ? 30 * 1000 : false,
  });
  return {
    data: (data?.data ?? []) as CircuitBreakerState[],
    ...rest,
  };
}
