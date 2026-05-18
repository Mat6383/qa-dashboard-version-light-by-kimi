import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient global de l'application.
 * Configuration optimisée pour le dashboard :
 * - staleTime : 5 min (les métriques changent peu fréquemment)
 * - gcTime : 10 min (garde les données en cache pour navigation rapide)
 * - refetchOnWindowFocus : true (mise à jour en arrière-plan quand l'onglet reprend le focus)
 * - retry : 1 (évite de spammer en cas d'erreur réseau temporaire)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
