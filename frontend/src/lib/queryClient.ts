import { QueryCache, QueryClient } from '@tanstack/react-query';

function handleTrpcAuthError(error: any) {
  const code = error?.data?.code || error?.meta?.responseJSON?.[0]?.error?.code;
  const message = error?.message || '';
  if (code === 'UNAUTHORIZED' || message.includes('Unauthorized')) {
    window.location.href = '/login';
  }
}

/**
 * QueryClient global de l'application.
 * Configuration optimisée pour le dashboard :
 * - staleTime : 5 min (les métriques changent peu fréquemment)
 * - gcTime : 10 min (garde les données en cache pour navigation rapide)
 * - refetchOnWindowFocus : true (mise à jour en arrière-plan quand l'onglet reprend le focus)
 * - retry : 1 (évite de spammer en cas d'erreur réseau temporaire)
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleTrpcAuthError,
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
