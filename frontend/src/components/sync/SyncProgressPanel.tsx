import React from 'react';
import {
  Zap,
  RefreshCw,
} from 'lucide-react';
import { LogIcon, logLineClass, LogLineText } from '../SyncLogParts';

export default function SyncProgressPanel({
  logLines,
  liveProgress,
  finalStats,
  state,
  logEndRef,
}) {
  return (
    <div className="d6-section">
      <div className="d6-section-header">
        <Zap size={14} />
        {state === 'syncing' ? 'Progression en cours...' : 'Synchronisation terminée'}
      </div>
      <div className="d6-section-body">
        {/* Barre de progression */}
        {liveProgress !== null && (
          <div className="d6-progress-bar-outer">
            <div className="d6-progress-bar-inner" style={{ width: `${liveProgress}%` }} />
          </div>
        )}

        {/* Log SSE */}
        <div className="d6-log">
          {logLines.map((event, i) => (
            <div key={i} className={`d6-log-line ${logLineClass(event.type)}`}>
              <span className="d6-log-icon">
                <LogIcon type={event.type} />
              </span>
              <span className="d6-log-text">
                <LogLineText event={event} />
              </span>
            </div>
          ))}
          {state === 'syncing' && (
            <div className="d6-log-line d6-log-info">
              <span className="d6-log-icon">
                <RefreshCw size={13} className="d6-spinner" />
              </span>
              <span className="d6-log-text">Synchronisation en cours...</span>
            </div>
          )}
          <div ref={logEndRef} />
        </div>

        {/* Stats finales */}
        {state === 'done' && finalStats && (
          <>
            <div className="d6-stats-row">
              <div className="d6-stat-card">
                <div className="d6-stat-number d6-stat-created">{finalStats.created}</div>
                <div className="d6-stat-label">Créés</div>
              </div>
              <div className="d6-stat-card">
                <div className="d6-stat-number d6-stat-updated">{finalStats.updated}</div>
                <div className="d6-stat-label">Mis à jour</div>
              </div>
              <div className="d6-stat-card">
                <div className="d6-stat-number d6-stat-skipped">{finalStats.skipped}</div>
                <div className="d6-stat-label">Ignorés</div>
              </div>
              <div className="d6-stat-card">
                <div className="d6-stat-number d6-stat-errors">{finalStats.errors}</div>
                <div className="d6-stat-label">Erreurs</div>
              </div>
            </div>
            {finalStats.testmoRunUrl && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <a
                  href={finalStats.testmoRunUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="d6-btn d6-btn-primary"
                >
                  Ouvrir le dossier Testmo →
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
