/**
 * ================================================
 * DASHBOARD 6 - Synchronisation GitLab → Testmo
 * ================================================
 * Orchestrateur : state, logique métier, SSE stream.
 * Le rendu est délégué aux panels dans components/sync/.
 *
 * Flow:
 *   idle → analyzing → preview → syncing → done
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.1.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings,
  AlertCircle,
} from 'lucide-react';
import apiService from '../services/api.service';
import { API_BASE_URL as API_BASE, fetchCredentials } from '../services/http.config';
import { isApiSuccess } from '../types/api.types';
import '../styles/Dashboard6.css';
import SyncHistoryPanel from './SyncHistoryPanel';
import SyncConfigPanel from './sync/SyncConfigPanel';
import SyncPreviewPanel from './sync/SyncPreviewPanel';
import SyncProgressPanel from './sync/SyncProgressPanel';

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function Dashboard6({ isDark }) {
  // ---- State ----------------------------------------------------
  const [state, setState] = useState('idle'); // idle | analyzing | preview | syncing | done
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [iterations, setIterations] = useState([]);
  const [iterSearch, setIterSearch] = useState('');
  const [selectedIter, setSelectedIter] = useState('');
  const [loadingIters, setLoadingIters] = useState(false);
  const [labelCustomFilter, setLabelCustomFilter] = useState('TESTMO');
  const [statusFilter, setStatusFilter] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [versionDeTestFilter, setVersionDeTestFilter] = useState('');
  const [runName, setRunName] = useState('');
  const [source, setSource] = useState('gitlab-sync');
  const [preview, setPreview] = useState(null);
  const [logLines, setLogLines] = useState([]);
  const [finalStats, setFinalStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const logEndRef = useRef(null);
  const iterTimerRef = useRef(null);
  const abortCtrlRef = useRef(null);
  const mountedRef = useRef(true);

  // ---- Chargement initial ----------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    loadProjects();
    loadHistory();
    return () => {
      mountedRef.current = false;
      if (iterTimerRef.current) clearTimeout(iterTimerRef.current);
      if (abortCtrlRef.current) abortCtrlRef.current.abort();
    };
  }, []);

  // Auto-scroll du log
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logLines]);

  // ---- Chargement des projets ------------------------------------
  const loadProjects = async () => {
    try {
      const list = await apiService.getSyncProjects();
      if (!mountedRef.current) return;
      setProjects(list);
      const firstConfigured = list.find((p) => p.configured);
      if (firstConfigured) setSelectedProject(firstConfigured.id);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError('Impossible de charger les projets: ' + getErrorMessage(err));
    }
  };

  const loadHistory = async () => {
    try {
      const rows = await apiService.getSyncHistory();
      if (!mountedRef.current) return;
      setHistory(rows || []);
    } catch (_) {
      // Historique non critique
    }
  };

  // ---- Chargement des itérations (avec debounce) -----------------
  const loadIterations = useCallback(
    async (projectId, search) => {
      if (!projectId) return;
      const project = projects.find((p) => p.id === projectId);
      if (!project?.configured) return;

      setLoadingIters(true);
      setIterations([]);
      setSelectedIter('');
      try {
        const list = await apiService.getSyncIterations(projectId, search);
        if (!mountedRef.current) return;
        setIterations(list || []);
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        setError('Impossible de charger les itérations: ' + getErrorMessage(err));
      } finally {
        if (mountedRef.current) setLoadingIters(false);
      }
    },
    [projects]
  );

  useEffect(() => {
    if (selectedProject) {
      loadIterations(selectedProject, iterSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const handleIterSearchChange = (e) => {
    const val = e.target.value;
    setIterSearch(val);
    if (iterTimerRef.current) clearTimeout(iterTimerRef.current);
    iterTimerRef.current = setTimeout(() => {
      loadIterations(selectedProject, val);
    }, 400);
  };

  // ---- Analyse (preview) -----------------------------------------
  const handleAnalyze = async () => {
    if (!selectedProject) {
      setError('Veuillez sélectionner un projet.');
      return;
    }
    setError(null);
    setPreview(null);
    setState('analyzing');

    try {
      const data = await apiService.previewSyncCases(
        selectedProject,
        selectedIter,
        {
          label: labelCustomFilter.trim() || 'Test::TODO',
          gitlab_status: statusFilter.trim() || undefined,
          version_prod: versionFilter.trim() || undefined,
          version_test: versionDeTestFilter.trim() || undefined,
          run_name: runName.trim() || undefined,
        }
      );
      setPreview(data);
      setState('preview');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setState('idle');
    }
  };

  // ---- Exécution avec SSE ----------------------------------------
  const handleExecute = () => {
    if (!selectedProject) {
      setError('Veuillez sélectionner un projet.');
      return;
    }
    setError(null);
    setLogLines([]);
    setFinalStats(null);
    setState('syncing');

    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    const body = {
      project_id: selectedProject,
      iteration_name: selectedIter,
      label: labelCustomFilter.trim() || 'Test::TODO',
      root_folder_id: 4514,
      dry_run: false,
      gitlab_status: statusFilter.trim() || undefined,
      version_prod: versionFilter.trim() || undefined,
      version_test: versionDeTestFilter.trim() || undefined,
      run_name: runName.trim() || undefined,
    };

    fetch(`${API_BASE}/sync/cases/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      ...fetchCredentials,
    })
      .then(async (response) => {
        if (!response.ok) {
          const json = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(json.error || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processChunk = (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                setLogLines((prev) => [...prev, event]);

                if (event.level === 'summary') {
                  setFinalStats({
                    created: event.created || 0,
                    updated: event.updated || 0,
                    skipped: event.skipped || 0,
                    enriched: event.enriched || 0,
                    errors: event.errors || 0,
                    total: event.total_issues || 0,
                    testmoRunUrl: event.testmo_run_url || null,
                  });
                }

                if (event.level === 'done' || event.type === 'done') {
                  setState('done');
                  loadHistory();
                }

                if (event.type === 'error') {
                  setError(event.message || 'Erreur inconnue');
                  setState('preview');
                }
              } catch (_) {
                // Ligne non-JSON (heartbeat :ping), on ignore
              }
            }
          }
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer) processChunk('');
            break;
          }
          processChunk(decoder.decode(value, { stream: true }));
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Erreur connexion SSE: ' + err.message);
          setState('preview');
        }
      });
  };

  // ---- Sync rapide (preview + execute auto) ------------------------
  const handleQuickSync = async () => {
    if (!selectedProject) {
      setError('Veuillez sélectionner un projet.');
      return;
    }
    setError(null);
    setPreview(null);
    setState('analyzing');

    try {
      const data = await apiService.previewSyncCases(
        selectedProject,
        selectedIter,
        {
          label: labelCustomFilter.trim() || 'Test::TODO',
          gitlab_status: statusFilter.trim() || undefined,
          version_prod: versionFilter.trim() || undefined,
          version_test: versionDeTestFilter.trim() || undefined,
          run_name: runName.trim() || undefined,
        }
      );
      setPreview(data);

      // Vérifier si exécution auto est safe (erreurs = iid null dans le mapping backend)
      const hasErrors = data?.issues?.some((i) => i.iid === null);
      const summary = data?.summary;
      const hasWorkToDo = summary && (summary.toCreate > 0 || summary.toUpdate > 0);

      if (hasErrors) {
        setState('preview');
        setError('Des erreurs ont été détectées dans le preview. Veuillez vérifier avant de synchroniser.');
        return;
      }

      if (!hasWorkToDo) {
        setState('preview');
        setError('Rien à synchroniser — tous les éléments sont à jour.');
        return;
      }

      // Tout est OK : lancer l'exécution
      setState('preview');
      setTimeout(() => handleExecute(), 0);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setState('idle');
    }
  };

  // ---- Reset -------------------------------------------------------
  const handleReset = () => {
    setState('idle');
    setPreview(null);
    setLogLines([]);
    setFinalStats(null);
    setError(null);
  };

  // ---- Helpers UI --------------------------------------------------
  const currentProject = projects.find((p) => p.id === selectedProject);
  const isConfigured = currentProject?.configured === true;
  const canAnalyze = isConfigured && state === 'idle';
  const canExecute = isConfigured && state === 'preview';
  const canQuickSync = isConfigured && (state === 'idle' || state === 'preview');
  const processedCount = logLines.filter((e) =>
    ['case_created', 'case_updated', 'case_skipped', 'case_error'].includes(e.type)
  ).length;
  const totalFromPreview = preview?.summary?.total || 0;
  const liveProgress =
    totalFromPreview > 0 ? Math.min(100, Math.round((processedCount / totalFromPreview) * 100)) : null;

  // ---- Rendu -------------------------------------------------------
  return (
    <div className={`d6-container${isDark ? ' dark-theme' : ''}`}>
      {/* Titre */}
      <div className="d6-title">
        <Settings size={22} />
        SYNCHRONISATION GITLAB → TESTMO CASES
      </div>

      {/* Message d'erreur global */}
      {error && (
        <div className="d6-alert d6-alert-error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={16} />
          {error}
          <button
            className="d6-btn d6-btn-ghost"
            style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.75rem' }}
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ---- Section Configuration ---- */}
      <SyncConfigPanel
        projects={projects}
        selectedProject={selectedProject}
        onProjectChange={setSelectedProject}
        currentProject={currentProject}
        isConfigured={isConfigured}
        iterSearch={iterSearch}
        onIterSearchChange={handleIterSearchChange}
        iterations={iterations}
        selectedIter={selectedIter}
        onIterChange={setSelectedIter}
        loadingIters={loadingIters}
        onReloadIters={() => loadIterations(selectedProject, iterSearch)}
        labelCustomFilter={labelCustomFilter}
        onLabelChange={setLabelCustomFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        versionFilter={versionFilter}
        onVersionChange={setVersionFilter}
        versionDeTestFilter={versionDeTestFilter}
        onVersionTestChange={setVersionDeTestFilter}
        runName={runName}
        onRunNameChange={setRunName}
        source={source}
        onSourceChange={setSource}
        state={state}
        canAnalyze={canAnalyze}
        onAnalyze={handleAnalyze}
        onQuickSync={handleQuickSync}
        canQuickSync={canQuickSync}
        onReset={handleReset}
        showReset={state === 'preview' || state === 'done'}
      />

      {/* ---- Section Aperçu ---- */}
      {(state === 'preview' || state === 'syncing' || state === 'done') && preview && (
        <SyncPreviewPanel
          preview={preview}
          currentProject={currentProject}
          canExecute={canExecute}
          onExecute={handleExecute}
          state={state}
          onReset={handleReset}
        />
      )}

      {/* ---- Section Progression (SSE) ---- */}
      {(state === 'syncing' || state === 'done') && (
        <SyncProgressPanel
          logLines={logLines}
          liveProgress={liveProgress}
          finalStats={finalStats}
          state={state}
          logEndRef={logEndRef}
        />
      )}

      {/* ---- Section Historique ---- */}
      <SyncHistoryPanel history={history} onRefresh={loadHistory} />
    </div>
  );
}
