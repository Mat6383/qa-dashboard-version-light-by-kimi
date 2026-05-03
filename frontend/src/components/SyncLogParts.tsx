/**
 * ================================================
 * SYNC LOG PARTS — Helpers visuels pour les logs SSE
 * ================================================
 * formatDate, LogIcon, logLineClass, LogLineText
 * Utilisés par Dashboard6 (GitLab → Testmo sync).
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertCircle,
  FolderOpen,
  Zap,
  ChevronRight,
} from 'lucide-react';

/**
 * Formate une date ISO en dd/MM HH:mm
 */
export function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return iso;
  }
}

/** Icône selon le statut d'un log line */
export function LogIcon({ type }) {
  switch (type) {
    case 'case_created':
      return <CheckCircle2 size={13} className="d6-log-created" />;
    case 'case_updated':
      return <RefreshCw size={13} className="d6-log-updated" />;
    case 'case_skipped':
      return <SkipForward size={13} className="d6-log-skipped" />;
    case 'case_error':
      return <XCircle size={13} className="d6-log-error" />;
    case 'folder':
      return <FolderOpen size={13} className="d6-log-info" />;
    case 'start':
      return <Zap size={13} className="d6-log-info" />;
    case 'done':
      return <CheckCircle2 size={13} className="d6-log-done" />;
    case 'error':
      return <AlertCircle size={13} className="d6-log-error" />;
    default:
      return <span style={{ width: 13 }} />;
  }
}

/** Classe CSS selon le statut d'un log line */
export function logLineClass(type) {
  switch (type) {
    case 'case_created':
      return 'd6-log-created';
    case 'case_updated':
      return 'd6-log-updated';
    case 'case_skipped':
      return 'd6-log-skipped';
    case 'case_error':
      return 'd6-log-error';
    case 'done':
      return 'd6-log-done';
    case 'error':
      return 'd6-log-error';
    default:
      return 'd6-log-info';
  }
}

/** Texte d'une log line */
export function LogLineText({ event }) {
  const {
    type,
    name,
    gitlabIid,
    gitlabUrl,
    testmoUrl,
    message,
    parent,
    child,
    created,
    updated,
    skipped,

    errors,
    total,
  } = event;

  switch (type) {
    case 'start':
      return <span>Démarrage de la synchronisation...</span>;
    case 'folder':
      return (
        <span>
          Dossier prêt : <strong>{parent}</strong> <ChevronRight size={11} /> <strong>{child}</strong>
        </span>
      );
    case 'case_created':
      return (
        <span>
          Créé : <strong>#{gitlabIid}</strong> {name}
          {gitlabUrl && (
            <a className="d6-log-link" href={gitlabUrl} target="_blank" rel="noreferrer">
              {' '}
              [GitLab]
            </a>
          )}
          {testmoUrl && (
            <a className="d6-log-link" href={testmoUrl} target="_blank" rel="noreferrer">
              {' '}
              [Testmo]
            </a>
          )}
        </span>
      );
    case 'case_updated':
      return (
        <span>
          Mis à jour : <strong>#{gitlabIid}</strong> {name}
          {testmoUrl && (
            <a className="d6-log-link" href={testmoUrl} target="_blank" rel="noreferrer">
              {' '}
              [Testmo]
            </a>
          )}
        </span>
      );
    case 'case_skipped':
      return (
        <span>
          Ignoré (enrichi manuellement) : <strong>#{gitlabIid}</strong> {name}
        </span>
      );
    case 'case_error':
      return (
        <span>
          Erreur sur <strong>#{gitlabIid}</strong> {name} : {message}
        </span>
      );
    case 'error':
      return <span>Erreur fatale : {message}</span>;
    case 'done':
      return (
        <span>
          Terminé — Créés: <strong>{created}</strong> | MàJ: <strong>{updated}</strong> | Ignorés:{' '}
          <strong>{skipped}</strong> | Erreurs: <strong>{errors}</strong> | Total: <strong>{total}</strong>
        </span>
      );
    default:
      return <span>{JSON.stringify(event)}</span>;
  }
}
