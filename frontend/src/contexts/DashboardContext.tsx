import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import apiService from '../services/api.service';
import { useDashboardWebSocket } from '../hooks/useDashboardWebSocket';
import { useProjects, useAnomalies, useCircuitBreakers, useDashboardMetrics } from '../hooks/queries';
import { queryClient } from '../lib/queryClient';
import type { DashboardMetrics, Project, AnomalyItem, CircuitBreakerState } from '../types/api.types';

export interface DashboardContextValue {
  projectId: number;
  setProjectId: (id: number) => void;
  projects: Project[];
  metrics: DashboardMetrics | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  backendStatus: 'checking' | 'ok' | 'error';
  exportHandler: (() => void) | null;
  setExportHandler: (handler: (() => void) | null) => void;
  selectedPreprodMilestones: number[];
  setSelectedPreprodMilestones: (milestones: number[]) => void;
  selectedProdMilestones: number[];
  setSelectedProdMilestones: (milestones: number[]) => void;
  showProductionSection: boolean;
  setShowProductionSection: (show: boolean) => void;
  autoRefresh: boolean;
  setAutoRefresh: (auto: boolean) => void;
  liveConnected: boolean;
  liveError: string | null;
  anomalies: AnomalyItem[];
  loadAnomalies: () => Promise<void>;
  circuitBreakers: CircuitBreakerState[];
  loadCircuitBreakers: () => Promise<void>;
  checkBackendHealth: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadDashboardMetrics: (force?: boolean) => Promise<void>;
  handleClearCache: () => Promise<void>;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState(() => parseInt(localStorage.getItem('testmo_projectId') || '1', 10));
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [exportHandler, setExportHandler] = useState<(() => void) | null>(null);
  const [selectedPreprodMilestones, setSelectedPreprodMilestones] = useState<number[]>(() => {
    const saved = localStorage.getItem('testmo_selectedPreprodMilestones');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedProdMilestones, setSelectedProdMilestones] = useState<number[]>(() => {
    const saved = localStorage.getItem('testmo_selectedProdMilestones');
    return saved ? JSON.parse(saved) : [];
  });
  const [showProductionSection, setShowProductionSection] = useState(() => {
    const saved = localStorage.getItem('testmo_showProductionSection');
    return saved !== null ? saved === 'true' : true;
  });

  const [autoRefresh, setAutoRefresh] = useState(() => {
    const saved = localStorage.getItem('testmo_autoRefresh');
    return saved !== null ? saved === 'true' : true;
  });

  const preprod = selectedPreprodMilestones.length > 0 ? selectedPreprodMilestones : null;
  const prod = selectedProdMilestones.length > 0 ? selectedProdMilestones : null;

  const sse = useDashboardWebSocket({
    projectId,
    preprodMilestones: selectedPreprodMilestones,
    prodMilestones: selectedProdMilestones,
    enabled: autoRefresh,
  });

  // ─── React Query hooks (remplacent useState + useEffect manuels) ───────────
  const { data: projects = [], refetch: refetchProjects } = useProjects();

  const { data: anomalies = [], refetch: refetchAnomalies } = useAnomalies(projectId);

  const { data: circuitBreakers = [], refetch: refetchCircuitBreakers } = useCircuitBreakers({ autoRefresh });

  const {
    data: metrics,
    isLoading: loading,
    error: queryError,
    dataUpdatedAt,
    refetch: refetchMetrics,
  } = useDashboardMetrics(projectId, preprod, prod, { autoRefresh, liveConnected: sse.connected });

  const error = queryError instanceof Error ? queryError.message : null;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  // Appliquer les données SSE temps réel dans le cache React Query
  useEffect(() => {
    if (sse.data) {
      queryClient.setQueryData<DashboardMetrics>(
        ['dashboard-metrics', projectId, preprod, prod],
        {
          ...sse.data.metrics,
          qualityRates: sse.data.qualityRates,
        }
      );
    }
  }, [sse.data, projectId, preprod, prod]);

  const checkBackendHealth = useCallback(async () => {
    try {
      await apiService.healthCheck();
      setBackendStatus('ok');
    } catch (err) {
      setBackendStatus('error');
      console.error('Backend health check failed:', err);
    }
  }, []);

  // Wrappers rétrocompatibles pour les consumers (useAutoRefresh, App.jsx, etc.)
  const loadProjects = useCallback(async () => {
    await refetchProjects();
  }, [refetchProjects]);

  const handleClearCache = useCallback(async () => {
    try {
      await apiService.clearCache();
    } catch (err) {
      console.error('Erreur nettoyage cache:', err);
    }
  }, []);

  const loadAnomalies = useCallback(async () => {
    await refetchAnomalies();
  }, [refetchAnomalies]);

  const loadCircuitBreakers = useCallback(async () => {
    await refetchCircuitBreakers();
  }, [refetchCircuitBreakers]);

  const loadDashboardMetrics = useCallback(
    async (force = false) => {
      await refetchMetrics();
    },
    [refetchMetrics]
  );

  useEffect(() => {
    try {
      localStorage.setItem('testmo_projectId', String(projectId));
      localStorage.setItem('testmo_selectedPreprodMilestones', JSON.stringify(selectedPreprodMilestones));
      localStorage.setItem('testmo_selectedProdMilestones', JSON.stringify(selectedProdMilestones));
      localStorage.setItem('testmo_showProductionSection', String(showProductionSection));
      localStorage.setItem('testmo_autoRefresh', String(autoRefresh));
    } catch (err) {
      console.warn('localStorage quota exceeded:', err);
    }
  }, [projectId, selectedPreprodMilestones, selectedProdMilestones, showProductionSection, autoRefresh]);

  // Sync cross-onglets via événement storage
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'testmo_projectId') {
        const id = parseInt(e.newValue || '1', 10);
        if (!isNaN(id)) setProjectId(id);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Validation des IDs projets au chargement
  useEffect(() => {
    if (Array.isArray(projects) && projects.length > 0) {
      const exists = projects.find((p) => p.id === projectId);
      if (!exists) {
        setProjectId(projects[0].id);
      }
    }
  }, [projects, projectId]);

  const value = useMemo(
    () => ({
      projectId,
      setProjectId,
      projects,
      metrics: metrics ?? null,
      loading,
      error,
      lastUpdate,
      backendStatus,
      exportHandler,
      setExportHandler,
      selectedPreprodMilestones,
      setSelectedPreprodMilestones,
      selectedProdMilestones,
      setSelectedProdMilestones,
      showProductionSection,
      setShowProductionSection,
      autoRefresh,
      setAutoRefresh,
      liveConnected: sse.connected,
      liveError: sse.error,
      anomalies,
      loadAnomalies,
      circuitBreakers,
      loadCircuitBreakers,
      checkBackendHealth,
      loadProjects,
      loadDashboardMetrics,
      handleClearCache,
    }),
    [
      projectId,
      projects,
      metrics,
      loading,
      error,
      lastUpdate,
      backendStatus,
      exportHandler,
      selectedPreprodMilestones,
      selectedProdMilestones,
      showProductionSection,
      autoRefresh,
      sse.connected,
      sse.error,
      anomalies,
      loadAnomalies,
      circuitBreakers,
      loadCircuitBreakers,
      checkBackendHealth,
      loadProjects,
      loadDashboardMetrics,
      handleClearCache,
    ]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
