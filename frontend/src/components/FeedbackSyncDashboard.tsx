/**
 * ================================================
 * Feedback Sync Dashboard
 * ================================================
 * Onglet Outils → Retours Testmo
 * Permet de lancer un scan manuel et consulter l'historique.
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
import type { SyncProject, FeedbackSyncRun } from '../types/api.types';
import '../styles/FeedbackSyncDashboard.css';

interface FeedbackSyncDashboardProps {
  isDark?: boolean;
}

export default function FeedbackSyncDashboard({ isDark }: FeedbackSyncDashboardProps) {
  const [projects, setProjects] = useState<SyncProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<FeedbackSyncRun | null>(null);
  const [history, setHistory] = useState<FeedbackSyncRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects & history on mount
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

  const handleScan = async () => {
    if (!selectedProjectId) return;
    setScanning(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await apiService.runFeedbackScan(Number(selectedProjectId), activeOnly);
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
          title="Rafraîchir l\'historique"
        >
          <RefreshCw size={16} />
        </button>
      </div>

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
