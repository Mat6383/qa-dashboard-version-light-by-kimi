import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/api.service';

/**
 * Hook pour consommer les feature flags du backend.
 * Support du rollout progressif sticky par utilisateur.
 *
 * @param {string|null} key - Si fourni, retourne uniquement ce flag. Sinon retourne tous.
 * @param {string|null} userId - ID utilisateur pour le rollout progressif déterministe.
 * @returns {{ flags: Object|boolean, loading: boolean, error: string|null, toggle: Function, refresh: Function, rolloutPercentage: number|null }}
 */
export function useFeatureFlags(key = null, userId = null) {
  const [flags, setFlags] = useState(key ? false : {});
  const [rolloutPercentage, setRolloutPercentage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  const fetchFlags = useCallback(async () => {
    cancelledRef.current = false;
    try {
      setLoading(true);
      const params = userId ? { userId } : {};
      const url = key ? `/feature-flags/${key}` : '/feature-flags';
      const res = await apiClient.get(url, { params });
      if (cancelledRef.current) return;

      if (key) {
        setFlags(res.data.data.enabled);
        setRolloutPercentage(res.data.data.rolloutPercentage ?? null);
      } else {
        setFlags(res.data.data);
        setRolloutPercentage(null);
      }
      setError(null);
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err.message);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [key, userId]);

  const toggle = useCallback(async (flagKey, enabled) => {
    try {
      await apiClient.put(`/feature-flags/${flagKey}`, { enabled });
      if (cancelledRef.current) return;
      setFlags((prev) => {
        if (typeof prev === 'boolean') return enabled;
        return { ...prev, [flagKey]: enabled };
      });
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchFlags]);

  return { flags, loading, error, toggle, refresh: fetchFlags, rolloutPercentage };
}

/**
 * Détermine si un flag est en rollout partiel (bêta).
 * Utile pour afficher un badge "bêta / X%".
 * @param {number|null} rolloutPercentage
 * @returns {boolean}
 */
export function isBetaRollout(rolloutPercentage) {
  return rolloutPercentage !== null && rolloutPercentage > 0 && rolloutPercentage < 100;
}
