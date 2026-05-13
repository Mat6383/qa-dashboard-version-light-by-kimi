import React from 'react';
import {
  Settings,
  RefreshCw,
  Search,
  AlertCircle,
} from 'lucide-react';

export default function SyncConfigPanel({
  projects,
  selectedProject,
  onProjectChange,
  currentProject,
  isConfigured,
  iterSearch,
  onIterSearchChange,
  iterations,
  selectedIter,
  onIterChange,
  loadingIters,
  onReloadIters,
  labelCustomFilter,
  onLabelChange,
  statusFilter,
  onStatusChange,
  versionFilter,
  onVersionChange,
  versionDeTestFilter,
  onVersionTestChange,
  runName,
  onRunNameChange,
  source,
  onSourceChange,
  state,
  canAnalyze,
  onAnalyze,
  onReset,
  showReset,
}) {
  return (
    <div className="d6-section">
      <div className="d6-section-header">
        <Settings size={14} />
        Configuration
      </div>
      <div className="d6-section-body">
        <div className="d6-config-row">
          {/* Sélecteur de projet */}
          <div className="d6-field">
            <label>Projet</label>
            <select
              className="d6-select"
              value={selectedProject || ''}
              onChange={(e) => onProjectChange(e.target.value)}
              disabled={state === 'syncing' || state === 'analyzing'}
            >
              <option value="" disabled>
                Choisir un projet...
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} {p.configured ? '' : '(non configuré)'}
                </option>
              ))}
            </select>
          </div>

          {/* Statut projet */}
          {currentProject && (
            <div style={{ paddingTop: '1.2rem' }}>
              <span className={`d6-badge ${isConfigured ? 'd6-badge-configured' : 'd6-badge-unconfigured'}`}>
                {isConfigured ? 'Configuré' : 'Non configuré'}
              </span>
            </div>
          )}
        </div>

        {/* Message si projet non configuré */}
        {currentProject && !isConfigured && (
          <div className="d6-alert d6-alert-warn" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={15} />
            Ce projet n&apos;est pas encore configuré — accès GitLab manquant.
          </div>
        )}

        {/* Sélecteur d'itération (uniquement si projet configuré) */}
        {isConfigured && (
          <>
            <div className="d6-config-row">
              {/* Recherche itération */}
              <div className="d6-field">
                <label>Rechercher une itération</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="d6-input"
                    placeholder="Ex: R14"
                    value={iterSearch}
                    onChange={onIterSearchChange}
                    disabled={state === 'syncing' || state === 'analyzing'}
                    style={{ paddingLeft: '32px' }}
                  />
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                </div>
              </div>

              {/* Dropdown itération */}
              <div className="d6-field">
                <label>
                  Itération
                  {loadingIters && <RefreshCw size={11} className="d6-spinner" style={{ marginLeft: 6 }} />}
                </label>
                <select
                  className="d6-select"
                  value={selectedIter}
                  onChange={(e) => onIterChange(e.target.value)}
                  disabled={state === 'syncing' || state === 'analyzing' || loadingIters}
                >
                  <option value="">Toutes les itérations (optionnel)</option>
                  {iterations.map((it) => (
                    <option key={it.id} value={it.title}>
                      {it.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bouton reload itérations */}
              <div style={{ paddingTop: '1.2rem' }}>
                <button
                  className="d6-btn d6-btn-ghost"
                  title="Recharger les itérations"
                  onClick={onReloadIters}
                  disabled={loadingIters || state === 'syncing' || state === 'analyzing'}
                >
                  <RefreshCw size={14} className={loadingIters ? 'd6-spinner' : ''} />
                </button>
              </div>
            </div>

            {/* Filtres avancés */}
            <div className="d6-config-row" style={{ marginTop: '0.5rem' }}>
              <div className="d6-field">
                <label>Label custom</label>
                <input
                  className="d6-input"
                  placeholder="Ex: TESTMO"
                  value={labelCustomFilter}
                  onChange={(e) => onLabelChange(e.target.value)}
                  disabled={state === 'syncing' || state === 'analyzing'}
                />
              </div>
              <div className="d6-field">
                <label>Status GitLab</label>
                <input
                  className="d6-input"
                  placeholder="Ex: Test TODO"
                  value={statusFilter}
                  onChange={(e) => onStatusChange(e.target.value)}
                  disabled={state === 'syncing' || state === 'analyzing'}
                />
              </div>
              <div className="d6-field">
                <label>Version Prod</label>
                <input
                  className="d6-input"
                  placeholder="Ex: R06 - Pilot"
                  value={versionFilter}
                  onChange={(e) => onVersionChange(e.target.value)}
                  disabled={state === 'syncing' || state === 'analyzing'}
                />
              </div>
              <div className="d6-field">
                <label>Version de test</label>
                <input
                  className="d6-input"
                  placeholder="Ex: R06 - run 1"
                  value={versionDeTestFilter}
                  onChange={(e) => onVersionTestChange(e.target.value)}
                  disabled={state === 'syncing' || state === 'analyzing'}
                />
              </div>
              <div className="d6-field">
                <label>Nom du run cible</label>
                <input
                  className="d6-input"
                  placeholder="Ex: R14 - run 3"
                  value={runName}
                  onChange={(e) => onRunNameChange(e.target.value)}
                  disabled={state === 'syncing' || state === 'analyzing'}
                  title="Nom du dossier cible dans Testmo (indépendant de l'itération)"
                />
              </div>
              <div className="d6-field">
                <label>Source Testmo</label>
                <input
                  className="d6-input"
                  placeholder="gitlab-sync"
                  value={source}
                  onChange={(e) => onSourceChange(e.target.value)}
                  disabled={state === 'syncing' || state === 'analyzing'}
                  title="Nom de la source dans Testmo"
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="d6-btn-row">
              <button className="d6-btn d6-btn-primary" onClick={onAnalyze} disabled={!canAnalyze}>
                {state === 'analyzing' ? (
                  <>
                    <RefreshCw size={14} className="d6-spinner" /> Analyse en cours...
                  </>
                ) : (
                  <>
                    <Search size={14} /> Analyser
                  </>
                )}
              </button>

              {showReset && (
                <button className="d6-btn d6-btn-ghost" onClick={onReset}>
                  Recommencer
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
