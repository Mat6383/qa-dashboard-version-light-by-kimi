/**
 * ================================================
 * DASHBOARD 8 — Auto-Sync Control Panel
 * ================================================
 * Panneau de contrôle pour la synchronisation
 * automatique Testmo → GitLab.
 *
 * Fonctionnalités :
 *   - Voir & modifier la config cron à chaud
 *   - Activer / désactiver la sync automatique
 *   - Déclencher une sync manuelle (avec log SSE)
 *   - Déclencher un dry-run pour prévisualiser
 *
 * @author Matou - Neo-Logix QA Lead
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock, Play, Eye, Save, RefreshCw,
  CheckCircle2, XCircle, AlertCircle,
  ToggleLeft, ToggleRight, Terminal, Zap
} from 'lucide-react';
import apiService from '../services/api.service';
import { useSyncProgress } from '../hooks/useSyncProgress';
import '../styles/Dashboard8.css';

// ─── Sous-composant : badge statut ───────────────────────────────────────────
function StatusBadge({ enabled }) {
  return enabled
    ? <span className="d8-badge d8-badge--on"><CheckCircle2 size={13} /> Actif</span>
    : <span className="d8-badge d8-badge--off"><XCircle size={13} /> Inactif</span>;
}

// ─── Sous-composant : ligne de log SSE ───────────────────────────────────────
function LogLine({ entry }) {
  const cls = {
    info:         'd8-log-info',
    warn:         'd8-log-warn',
    error:        'd8-log-error',
    updated:      'd8-log-updated',
    'would-update': 'd8-log-would',
    skip:         'd8-log-skip',
    done:         'd8-log-done',
  }[entry.type] || 'd8-log-info';

  let text = '';
  if (entry.message)  text = entry.message;
  else if (entry.type === 'updated')
    text = `✓ #${entry.issueIid} "${entry.caseName}" → status:${entry.newStatus}`;
  else if (entry.type === 'would-update')
    text = `[DRY] #${entry.issueIid} "${entry.caseName}" : ${entry.currentStatus || '∅'} → ${entry.newStatus}`;
  else if (entry.type === 'skip')
    text = `⊘ "${entry.caseName}" — ${entry.reason}`;
  else if (entry.type === 'error')
    text = `✗ #${entry.issueIid} "${entry.caseName}": ${entry.error}`;
  else if (entry.type === 'done')
    text = `Terminé — updated=${entry.updated} skipped=${entry.skipped} errors=${entry.errors} total=${entry.total}`;
  else text = JSON.stringify(entry);

  return <div className={`d8-log-line ${cls}`}>{text}</div>;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Dashboard8({ isDark }) {
  const [config, setConfig]         = useState(null);
  const [form, setForm]             = useState({ runId: '', iterationName: '', gitlabProjectId: '', version: '' });
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'ok' | 'error'
  const [loadError, setLoadError]   = useState(null);
  const [runMode, setRunMode]       = useState(null); // 'live' | 'dryrun'
  const logEndRef = useRef(null);
  const { logs, running, start, stop } = useSyncProgress('/sync/status-to-gitlab');

  // ── Charger la config courante ──────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await apiService.getAutoSyncConfig();
      setConfig(data);
      setForm({
        runId:           String(data.runId   ?? ''),
        iterationName:   data.iterationName  ?? '',
        gitlabProjectId: String(data.gitlabProjectId ?? ''),
        version:         data.version ?? '',
      });
    } catch (err) {
      setLoadError('Impossible de charger la config : ' + err.message);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Scroll automatique vers le bas dans le log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── Sauvegarder la config ───────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const patch = {
        runId:           parseInt(form.runId),
        iterationName:   form.iterationName.trim(),
        gitlabProjectId: form.gitlabProjectId.trim(),
        version:         form.version.trim() || undefined,
      };
      if (!patch.runId || !patch.iterationName || !patch.gitlabProjectId) {
        setSaveStatus('error');
        return;
      }
      const updated = await apiService.updateAutoSyncConfig(patch);
      setConfig(updated);
      setSaveStatus('ok');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // ── Basculer enabled ────────────────────────────────────────────────────────
  const handleToggleEnabled = async () => {
    try {
      const updated = await apiService.updateAutoSyncConfig({ enabled: !config.enabled });
      setConfig(updated);
    } catch (err) {
      console.error('Erreur toggle enabled:', err);
    }
  };

  // ── Lancer une sync manuelle (SSE) ─────────────────────────────────────────
  const handleRun = async (dryRun = false) => {
    if (running) return;
    setRunMode(dryRun ? 'dryrun' : 'live');

    const { runId, iterationName, gitlabProjectId, version } = config;
    if (!runId || !iterationName || !gitlabProjectId) {
      stop();
      setRunMode(null);
      return;
    }

    await start({ runId, iterationName, gitlabProjectId, dryRun, version: version || undefined });
    setRunMode(null);
  };

  const handleStop = () => {
    stop();
    setRunMode(null);
  };

  // ─── Calcul prochaine exécution cron (affichage indicatif) ────────────────
  const nextCronInfo = () => {
    const now = new Date();
    const day  = now.getDay(); // 0=dim, 1=lun ... 5=ven, 6=sam
    const h    = now.getHours();
    const m    = now.getMinutes();
    const isWeekday = day >= 1 && day <= 5;
    const isInWindow = h >= 8 && h < 18;

    if (isWeekday && isInWindow) {
      const nextMin = m - (m % 5) + 5;
      if (nextMin < 60) return `Aujourd'hui à ${h}h${String(nextMin).padStart(2, '0')}`;
      return `Aujourd'hui à ${h + 1}h00`;
    }
    return 'Lun-Ven entre 8h et 18h';
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className={`d8-root ${isDark ? 'dark' : ''}`}>
        <div className="d8-error-banner">
          <AlertCircle size={18} /> {loadError}
          <button className="d8-btn-ghost" onClick={loadConfig}>Réessayer</button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`d8-root ${isDark ? 'dark' : ''}`}>
        <div className="d8-loading"><RefreshCw size={24} className="spinning" /> Chargement…</div>
      </div>
    );
  }

  const formDirty =
    String(form.runId)           !== String(config.runId ?? '')           ||
    form.iterationName            !== (config.iterationName ?? '')         ||
    String(form.gitlabProjectId)  !== String(config.gitlabProjectId ?? '') ||
    form.version                  !== (config.version ?? '');

  return (
    <div className={`d8-root ${isDark ? 'dark' : ''}`}>
      {/* ── Titre ── */}
      <div className="d8-header">
        <div className="d8-header-title">
          <Zap size={22} className="d8-header-icon" />
          <h2>Auto-Sync Testmo → GitLab</h2>
        </div>
        <p className="d8-header-sub">
          Synchronisation automatique des statuts et commentaires — cron lun-ven 8h-18h toutes les 5 min
        </p>
      </div>

      <div className="d8-grid">

        {/* ── Carte statut ── */}
        <div className="d8-card d8-card--status">
          <div className="d8-card-title"><Clock size={16} /> Statut du cron</div>

          <div className="d8-status-row">
            <span>État</span>
            <StatusBadge enabled={config.enabled} />
          </div>
          <div className="d8-status-row">
            <span>Prochaine exécution</span>
            <span className="d8-value">{config.enabled ? nextCronInfo() : '—'}</span>
          </div>
          <div className="d8-status-row">
            <span>Dernière mise à jour config</span>
            <span className="d8-value">
              {config.updatedAt
                ? new Date(config.updatedAt).toLocaleString('fr-FR')
                : 'Valeurs initiales (.env)'}
            </span>
          </div>

          <button
            className={`d8-btn-toggle ${config.enabled ? 'd8-btn-toggle--on' : 'd8-btn-toggle--off'}`}
            onClick={handleToggleEnabled}
          >
            {config.enabled
              ? <><ToggleRight size={18} /> Désactiver le cron</>
              : <><ToggleLeft  size={18} /> Activer le cron</>}
          </button>
        </div>

        {/* ── Carte config ── */}
        <div className="d8-card d8-card--config">
          <div className="d8-card-title"><Save size={16} /> Configuration du run actif</div>

          <div className="d8-form-group">
            <label>ID du run Testmo</label>
            <input
              type="number"
              className="d8-input"
              value={form.runId}
              placeholder="ex : 279"
              onChange={e => setForm(f => ({ ...f, runId: e.target.value }))}
            />
          </div>

          <div className="d8-form-group">
            <label>Nom de l'itération GitLab</label>
            <input
              type="text"
              className="d8-input"
              value={form.iterationName}
              placeholder="ex : R14 - run 1"
              onChange={e => setForm(f => ({ ...f, iterationName: e.target.value }))}
            />
          </div>

          <div className="d8-form-group">
            <label>ID du projet GitLab</label>
            <input
              type="text"
              className="d8-input"
              value={form.gitlabProjectId}
              placeholder="ex : 63"
              onChange={e => setForm(f => ({ ...f, gitlabProjectId: e.target.value }))}
            />
          </div>

          <div className="d8-form-group">
            <label>Version (champ custom GitLab, optionnel)</label>
            <input
              type="text"
              className="d8-input"
              value={form.version}
              placeholder="ex : 1.2.3"
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
            />
          </div>

          <div className="d8-form-actions">
            <button
              className={`d8-btn-primary ${!formDirty ? 'd8-btn--disabled' : ''}`}
              onClick={handleSave}
              disabled={!formDirty || saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? <><RefreshCw size={14} className="spinning" /> Enregistrement…</>
               : saveStatus === 'ok'   ? <><CheckCircle2 size={14} /> Enregistré !</>
               : saveStatus === 'error'? <><XCircle size={14} /> Erreur — vérifiez les champs</>
               : <><Save size={14} /> Enregistrer</>}
            </button>

            {formDirty && (
              <button
                className="d8-btn-ghost"
                onClick={() => setForm({
                  runId:           String(config.runId ?? ''),
                  iterationName:   config.iterationName ?? '',
                  gitlabProjectId: String(config.gitlabProjectId ?? ''),
                  version:         config.version ?? '',
                })}
              >
                Annuler
              </button>
            )}
          </div>

          {/* Résumé config active */}
          <div className="d8-config-summary">
            <div className="d8-summary-row">
              <span>Run actif</span>
              <strong>#{config.runId ?? '—'}</strong>
            </div>
            <div className="d8-summary-row">
              <span>Itération</span>
              <strong>{config.iterationName || '—'}</strong>
            </div>
            <div className="d8-summary-row">
              <span>Projet GitLab</span>
              <strong>#{config.gitlabProjectId || '—'}</strong>
            </div>
            <div className="d8-summary-row">
              <span>Version</span>
              <strong>{config.version || '—'}</strong>
            </div>
          </div>
        </div>

        {/* ── Carte déclenchement manuel ── */}
        <div className="d8-card d8-card--run">
          <div className="d8-card-title"><Terminal size={16} /> Déclenchement manuel</div>

          <div className="d8-run-actions">
            <button
              className="d8-btn-primary"
              onClick={() => handleRun(false)}
              disabled={running}
            >
              {running && runMode === 'live'
                ? <><RefreshCw size={14} className="spinning" /> Sync en cours…</>
                : <><Play size={14} /> Lancer la sync</>}
            </button>

            <button
              className="d8-btn-secondary"
              onClick={() => handleRun(true)}
              disabled={running}
            >
              {running && runMode === 'dryrun'
                ? <><RefreshCw size={14} className="spinning" /> Dry-run…</>
                : <><Eye size={14} /> Dry-run (preview)</>}
            </button>

            {running && (
              <button className="d8-btn-danger" onClick={handleStop}>
                <XCircle size={14} /> Arrêter
              </button>
            )}
          </div>

          <p className="d8-run-hint">
            Le <strong>dry-run</strong> affiche ce qui serait fait sans modifier GitLab.
          </p>

          {/* Log SSE */}
          {logs.length > 0 && (
            <div className="d8-log-container">
              {logs.map((entry, i) => <LogLine key={i} entry={entry} />)}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
