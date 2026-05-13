/**
 * ================================================
 * Feedback Sync Dashboard
 * ================================================
 * Onglet Outils → Retours Testmo
 * Permet de lancer un scan manuel (projet + runs sélectionnés)
 * et consulter l'historique.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Play,
  RefreshCw,
  Loader2,
  History,
  CheckCircle2,
  SkipForward,
  AlertCircle,
} from 'lucide-react';
import apiService from '../services/api.service';
import type { SyncProject, FeedbackSyncRun, Run } from '../types/api.types';
import '../styles/FeedbackSyncDashboard.css';

interface FeedbackSyncDashboardProps {
  isDark?: boolean;
}

export default function FeedbackSyncDashboard({ isDark }: FeedbackSyncDashboardProps) {
  const [projects, setProjects] = useState<SyncProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState(true);

  const [runs, setRuns] = useState<Run[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number | string>>(new Set());

  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<FeedbackSyncRun | null>(null);
  const [history, setHistory] = useState<FeedbackSyncRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  const loadProjects = useCallback(async () => {
    try {
      const list = await apiService.getSyncProjects();
      const configured = list.filter((p) => p.configured && p.testmoProjectId);
      setProjects(configured);
      if (configured.length > 0 && !selectedProjectId) {
        setSelectedProjectId(String(configured[0].testmoProjectId));
      }
    } catch (err: any) {
      setError('Impossible de charger les projets : ' + (err.message || err));
    }
  }, [selectedProjectId]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const rows = await apiService.getFeedbackSyncHistory();
      setHistory(rows || []);
    } catch (err: any) {
      console.error('Erreur chargement historique:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadHistory();
  }, [loadProjects, loadHistory]);

  // Load runs when project changes
  const loadRuns = useCallback(async () => {
    if (!selectedProjectId) {
      setRuns([]);
      setSelectedRunIds(new Set());
      return;
    }
    setLoadingRuns(true);
    try {
      const data = (await apiService.getProjectRuns(Number(selectedProjectId), activeOnly)) as {
        runs?: Run[];
      };
      const list = data?.runs || [];
      setRuns(list);
      setSelectedRunIds(new Set());
    } catch (err: any) {
      console.error('Erreur chargement runs:', err);
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, [selectedProjectId, activeOnly]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const toggleRun = (runId: number | string) => {
    setSelectedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  const selectAllRuns = () => {
    setSelectedRunIds(new Set(runs.map((r) => r.id)));
  };

  const clearRunSelection = () => {
    setSelectedRunIds(new Set());
  };

  const handleScan = async () => {
    if (!selectedProjectId) return;
    setScanning(true);
    setError(null);
    setLastResult(null);
    try {
      const runIds = selectedRunIds.size > 0 ? Array.from(selectedRunIds).map(Number) : undefined;
      const result = await apiService.runFeedbackScan(Number(selectedProjectId), activeOnly, runIds);
      setLastResult(result);
      await loadHistory();
    } catch (err: any) {
      setError('Scan échoué : ' + (err.message || err));
    } finally {
      setScanning(false);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('fr-FR');
  };

  return (
    <div className="fsd-container">
      {/* Controls */}
      <div className="fsd-controls">
        <MessageSquare size={18} />
        <select
          className="fsd-select"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          disabled={scanning}
        >
          {projects.map((p) => (
            <option key={p.id} value={String(p.testmoProjectId)}>
              {p.label}
            </option>
          ))}
        </select>

        <label className="fsd-toggle">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            disabled={scanning}
          />
          Runs en cours uniquement
        </label>

        <button
          className="fsd-btn"
          onClick={handleScan}
          disabled={scanning || !selectedProjectId}
        >
          {scanning ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
          {scanning ? 'Scan en cours…' : 'Lancer le scan'}
        </button>

        <button
          className="fsd-btn"
          style={{ background: 'var(--text-secondary)' }}
          onClick={loadHistory}
          disabled={scanning || loadingHistory}
          title="Rafraîchir l'historique"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Run selector */}
      {selectedProjectId && (
        <div
          style={{
            padding: 'var(--spacing-md)',
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
            <strong style={{ fontSize: 'var(--font-small)' }}>
              Runs à scanner {selectedRunIds.size > 0 && `(${selectedRunIds.size}/${runs.length})`}
            </strong>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              <button
                onClick={selectAllRuns}
                disabled={loadingRuns || runs.length === 0}
                style={{ fontSize: 'var(--font-caption)', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}
              >
                Tout sélectionner
              </button>
              <button
                onClick={clearRunSelection}
                disabled={selectedRunIds.size === 0}
                style={{ fontSize: 'var(--font-caption)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Effacer
              </button>
            </div>
          </div>

          {loadingRuns ? (
            <div style={{ fontSize: 'var(--font-small)', color: 'var(--text-secondary)', padding: 'var(--spacing-sm)' }}>
              <Loader2 size={14} style={{ display: 'inline-block', marginRight: 6, animation: 'spin 1s linear infinite' }} />
              Chargement des runs…
            </div>
          ) : runs.length === 0 ? (
            <div style={{ fontSize: 'var(--font-small)', color: 'var(--text-secondary)', padding: 'var(--spacing-sm)' }}>
              Aucun run trouvé pour ce projet.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 'var(--spacing-xs)',
                maxHeight: 200,
                overflowY: 'auto',
                padding: 'var(--spacing-xs)',
              }}
            >
              {runs.map((run) => (
                <label
                  key={run.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-caption)',
                    background: selectedRunIds.has(run.id) ? 'var(--color-primary-bg, rgba(59,130,246,0.1))' : 'transparent',
                    border: selectedRunIds.has(run.id) ? '1px solid var(--color-primary)' : '1px solid transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRunIds.has(run.id)}
                    onChange={() => toggleRun(run.id)}
                    disabled={scanning}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {run.name}
                  </span>
                </label>
              ))}
            </div>
          )}

          {selectedRunIds.size === 0 && runs.length > 0 && (
            <div style={{ fontSize: 'var(--font-caption)', color: 'var(--text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              ℹ️ Aucun run sélectionné → le scan portera sur tous les runs affichés.
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="fsd-error">
          <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {error}
        </div>
      )}

      {/* Last result stats */}
      {lastResult && (
        <div className="fsd-stats">
          <div className="fsd-stat-card">
            <div className="fsd-stat-value">{lastResult.runsScanned}</div>
            <div className="fsd-stat-label">Runs scannés</div>
          </div>
          <div className="fsd-stat-card">
            <div className="fsd-stat-value">{lastResult.resultsChecked}</div>
            <div className="fsd-stat-label">Résultats vérifiés</div>
          </div>
          <div className="fsd-stat-card">
            <div className="fsd-stat-value" style={{ color: 'var(--color-success, #166534)' }}>
              {lastResult.ticketsCreated}
            </div>
            <div className="fsd-stat-label">Tickets créés</div>
          </div>
          <div className="fsd-stat-card">
            <div className="fsd-stat-value" style={{ color: 'var(--color-warning, #854d0e)' }}>
              {lastResult.ticketsSkipped}
            </div>
            <div className="fsd-stat-label">Doublons ignorés</div>
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h3 style={{ fontSize: 'var(--font-body)', marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={18} />
          Historique des scans
        </h3>

        {history.length === 0 ? (
          <div className="fsd-empty">
            {loadingHistory ? 'Chargement…' : 'Aucun scan enregistré.'}
          </div>
        ) : (
          <div className="fsd-history">
            <table className="fsd-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Déclencheur</th>
                  <th>Projet</th>
                  <th>Runs</th>
                  <th>Vérifiés</th>
                  <th>Créés</th>
                  <th>Ignorés</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <span className={`fsd-badge fsd-badge--${row.triggeredBy === 'cron' ? 'skipped' : 'created'}`}>
                        {row.triggeredBy === 'cron' ? 'Cron' : 'Manuel'}
                      </span>
                    </td>
                    <td>{row.projectId}</td>
                    <td>{row.runsScanned}</td>
                    <td>{row.resultsChecked}</td>
                    <td>{row.ticketsCreated}</td>
                    <td>{row.ticketsSkipped}</td>
                    <td>
                      {row.details?.length > 0 ? (
                        <span className="fsd-badge fsd-badge--created">
                          <CheckCircle2 size={12} />
                          {row.details.length} action(s)
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
