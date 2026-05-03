import { useEffect } from 'react';

/**
 * Hook de gestion du cycle de vie des données dashboard :
 * - Chargement initial au montage (health check + projets)
 *
 * La logique de rechargement des métriques est désormais entièrement
 * déléguée à React Query (refetchOnWindowFocus, refetchInterval,
 * invalidation via SSE).
 */
export function useAutoRefresh({ checkBackendHealth, loadProjects }) {
  // Chargement initial au montage
  useEffect(() => {
    checkBackendHealth();
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
