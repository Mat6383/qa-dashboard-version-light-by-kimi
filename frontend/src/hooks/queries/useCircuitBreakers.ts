import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api.service';
import type { CircuitBreakerState } from '../../types/api.types';

export const CIRCUIT_BREAKERS_KEY = ['circuit-breakers'] as const;

/**
 * Hook REST pour récupérer l'état des circuit breakers.
 * @param options - Configuration optionnelle
 */
export function useCircuitBreakers({ autoRefresh = false }: { autoRefresh?: boolean } = {}) {
  const { data, ...rest } = useQuery({
    queryKey: CIRCUIT_BREAKERS_KEY,
    queryFn: () => apiService.getCircuitBreakers(),
    staleTime: 30 * 1000,
    refetchInterval: autoRefresh ? 30 * 1000 : false,
  });

  const raw = (data as any)?.circuit_breakers ?? (data as any)?.data ?? [];
  return {
    data: (Array.isArray(raw) ? raw : []) as CircuitBreakerState[],
    ...rest,
  };
}
