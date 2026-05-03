/**
 * ================================================
 * DASHBOARD 7 - CrossTest OK — Tickets Validés
 * ================================================
 * Liste les issues GitLab avec label CrossTest::OK
 * pour une itération sélectionnée.
 * Commentaires persistants en SQLite (full CRUD inline).
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiService from '../services/api.service';
import { useVirtualizer } from '@tanstack/react-virtual';

import {
  Link2,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import '../styles/Dashboard7.css';
import CommentCell from './CommentCell';
import { useColumnOrder } from '../hooks/useColumnOrder';
import SortableTableHeader, { type ColumnDef } from './SortableTableHeader';

const CROSS_TEST_COLUMNS: ColumnDef[] = [
  { key: 'iid', label: '#' },
  { key: 'title', label: 'Ticket' },
  { key: 'assignees', label: 'Assigné(s)' },
  { key: 'state', label: 'Statut' },
  { key: 'comments', label: 'Commentaires' },
];

/* =========================================
   Sous-composant : tableau virtualisé
   ========================================= */
function VirtualIssueTable({
  issues,
  comments,
  selectedIteration,
  onCommentSaved,
  onCommentDeleted,
  tableWrapperRef,
  columnOrder,
  onReorder,
}) {
  const rowVirtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => tableWrapperRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  return (
    <div ref={tableWrapperRef} className="d7-table-wrapper">
      <table className="d7-table">
        <thead>
          <SortableTableHeader
            columns={CROSS_TEST_COLUMNS}
            columnOrder={columnOrder}
            onReorder={onReorder}
            tableId="crosstest"
          />
        </thead>
        <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const issue = issues[virtualRow.index];
            return (
              <tr
                key={virtualRow.key}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columnOrder.map((colKey) => {
                  switch (colKey) {
                    case 'iid':
                      return <td key={colKey}>{issue.iid}</td>;

                    case 'title':
                      return (
                        <td key={colKey}>
                          <a
                            className="d7-issue-link"
                            href={issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Ouvrir #${issue.iid} dans GitLab`}
                          >
                            <span className="d7-issue-iid">#{issue.iid}</span>
                            {issue.title}
                            <ExternalLink size={12} style={{ flexShrink: 0 }} />
                          </a>
                          {issue.labels && issue.labels.length > 0 && (
                            <div className="d7-labels">
                              {issue.labels.map((label) => (
                                <span key={label} className="d7-label-chip">
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );

                    case 'assignees':
                      return (
                        <td key={colKey}>
                          {issue.assignees && issue.assignees.length > 0 ? (
                            issue.assignees.join(', ')
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non assigné</span>
                          )}
                        </td>
                      );

                    case 'state':
                      return (
                        <td key={colKey}>
                          {issue.state === 'closed' ? (
                            <span className="d7-badge d7-badge-closed">
                              <CheckCircle2 size={11} />
                              Fermé
                            </span>
                          ) : (
                            <span className="d7-badge d7-badge-open">
                              <Clock size={11} />
                              Ouvert
                            </span>
                          )}
                        </td>
                      );

                    case 'comments':
                      return (
                        <td key={colKey} className="d7-comment-cell">
                          <CommentCell
                            issue={issue}
                            comment={comments[issue.iid] || null}
                            milestoneTitle={selectedIteration?.title}
                            onSaved={onCommentSaved}
                            onDeleted={onCommentDeleted}
                          />
                        </td>
                      );

                    default:
                      return <td key={colKey} />;
                  }
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================
   Composant principal Dashboard7
   ========================================= */
export default function Dashboard7({ isDark: _isDark }) {
  const [iterations, setIterations] = useState([]);
  const [selectedIteration, setSelectedIteration] = useState(null);
  const [issues, setIssues] = useState([]);
  const [comments, setComments] = useState({}); // { [iid]: row }
  const [filter, setFilter] = useState('');

  const tableWrapperRef = useRef(null);

  const [loadingIterations, setLoadingIterations] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [iterationsError, setIterationsError] = useState(null);
  const [issuesError, setIssuesError] = useState(null);

  /* ---- Chargement initial: itérations + commentaires ---- */
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoadingIterations(true);
      setIterationsError(null);
      try {
        const [iters, cmts] = await Promise.all([
          apiService.getCrosstestIterations(),
          apiService.getCrosstestComments(),
        ]);
        if (cancelled) return;
        setIterations(iters || []);
        setComments(cmts || {});
        // Sélectionner automatiquement la première itération
        if (iters && iters.length > 0 && !selectedIteration) {
          setSelectedIteration(iters[0]);
        }
      } catch (err) {
        if (cancelled) return;
        setIterationsError(err.message);
      } finally {
        if (!cancelled) setLoadingIterations(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Chargement des issues quand l'itération change ---- */
  useEffect(() => {
    if (!selectedIteration) return;
    let cancelled = false;

    async function loadIssues() {
      setLoadingIssues(true);
      setIssuesError(null);
      setFilter('');
      try {
        const data = await apiService.getCrosstestIssues(selectedIteration.id);
        if (!cancelled) setIssues(data || []);
      } catch (err) {
        if (!cancelled) setIssuesError(err.message);
      } finally {
        if (!cancelled) setLoadingIssues(false);
      }
    }

    loadIssues();
    return () => {
      cancelled = true;
    };
  }, [selectedIteration]);

  /* ---- Rafraîchir les issues ---- */
  const handleRefresh = useCallback(async () => {
    if (!selectedIteration) return;
    setLoadingIssues(true);
    setIssuesError(null);
    try {
      const [data, cmts] = await Promise.all([
        apiService.getCrosstestIssues(selectedIteration.id),
        apiService.getCrosstestComments(),
      ]);
      setIssues(data || []);
      setComments(cmts || {});
    } catch (err) {
      setIssuesError(err.message);
    } finally {
      setLoadingIssues(false);
    }
  }, [selectedIteration]);

  /* ---- Callbacks commentaires ---- */
  const handleCommentSaved = useCallback((iid, row) => {
    setComments((prev) => ({ ...prev, [iid]: row }));
  }, []);

  const handleCommentDeleted = useCallback((iid) => {
    setComments((prev) => {
      const next = { ...prev };
      delete next[iid];
      return next;
    });
  }, []);

  /* ---- Filtrage ---- */
  const filteredIssues = filter
    ? issues.filter((issue) => {
        const q = filter.toLowerCase();
        return (
          String(issue.iid).includes(q) ||
          issue.title.toLowerCase().includes(q) ||
          issue.assignees.join(' ').toLowerCase().includes(q) ||
          issue.labels.join(' ').toLowerCase().includes(q)
        );
      })
    : issues;

  const { columnOrder, setColumnOrder } = useColumnOrder(
    'crosstest',
    CROSS_TEST_COLUMNS.map((c) => c.key)
  );

  /* ---- Rendu ---- */
  return (
    <div className="d7-container">
      {/* Titre */}
      <div className="d7-header">
        <Link2 size={22} />
        CROSSTEST OK — TICKETS VALIDÉS
      </div>

      {/* Barre de contrôles */}
      <div className="d7-controls">
        <span className="d7-label">Itération :</span>

        {loadingIterations ? (
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} className="d7-spinner" style={{ display: 'inline', marginRight: 4 }} />
            Chargement...
          </span>
        ) : iterationsError ? (
          <span style={{ color: 'var(--text-danger)', fontSize: '0.875rem' }}>Erreur: {iterationsError}</span>
        ) : (
          <select
            className="d7-select"
            value={selectedIteration?.id ?? ''}
            onChange={(e) => {
              const found = iterations.find((it) => String(it.id) === e.target.value);
              setSelectedIteration(found || null);
            }}
            aria-label="Sélectionner une itération"
          >
            {iterations.length === 0 && <option value="">Aucune itération disponible</option>}
            {iterations.map((it) => (
              <option key={it.id} value={it.id}>
                {it.title}
                {it.state === 'closed' ? ' (terminée)' : ''}
              </option>
            ))}
          </select>
        )}

        <button
          className="d7-btn"
          onClick={handleRefresh}
          disabled={loadingIssues || !selectedIteration}
          title="Rafraîchir les issues"
        >
          <RefreshCw size={14} className={loadingIssues ? 'd7-spinner' : ''} />
          Rafraîchir
        </button>

        <div className="d7-spacer" />

        <input
          type="text"
          className="d7-filter-input"
          placeholder="Filtrer par titre, assigné, label..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filtrer les tickets"
        />
      </div>

      {/* Résumé */}
      {selectedIteration && !loadingIssues && !issuesError && (
        <p className="d7-summary">
          <strong>{filteredIssues.length}</strong>
          {filter
            ? ` ticket${filteredIssues.length !== 1 ? 's' : ''} correspondant au filtre (sur ${issues.length})`
            : ` ticket${issues.length !== 1 ? 's' : ''}`}{' '}
          avec <strong>CrossTest::OK</strong> pour <strong>{selectedIteration.title}</strong>
        </p>
      )}

      {/* Section tableau */}
      <div className="d7-table-section">
        {/* États: chargement / erreur / vide / itération non sélectionnée */}
        {!selectedIteration && !loadingIterations && (
          <div className="d7-state-box">
            <ChevronDown size={36} />
            <p className="d7-state-title">Sélectionnez une itération</p>
            <p className="d7-state-desc">Choisissez une itération dans le menu déroulant pour afficher les tickets.</p>
          </div>
        )}

        {loadingIssues && (
          <div className="d7-state-box">
            <RefreshCw size={36} className="d7-spinner" />
            <p className="d7-state-title">Chargement des tickets...</p>
            <p className="d7-state-desc">
              Interrogation de l&apos;API GitLab pour <strong>{selectedIteration?.title}</strong>.
            </p>
          </div>
        )}

        {issuesError && !loadingIssues && (
          <div className="d7-state-box d7-state-error">
            <AlertCircle size={36} />
            <p className="d7-state-title">Erreur de chargement</p>
            <p className="d7-state-desc">{issuesError}</p>
            <button className="d7-btn d7-btn-primary" onClick={handleRefresh}>
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {!loadingIssues && !issuesError && selectedIteration && issues.length === 0 && (
          <div className="d7-state-box">
            <MessageSquare size={36} />
            <p className="d7-state-title">Aucun ticket trouvé</p>
            <p className="d7-state-desc">
              Aucune issue avec le label <strong>CrossTest::OK</strong> pour l&apos;itération{' '}
              <strong>{selectedIteration.title}</strong>.
            </p>
          </div>
        )}

        {!loadingIssues && !issuesError && filteredIssues.length === 0 && issues.length > 0 && (
          <div className="d7-state-box">
            <MessageSquare size={36} />
            <p className="d7-state-title">Aucun résultat</p>
            <p className="d7-state-desc">Aucun ticket ne correspond au filtre &quot;{filter}&quot;.</p>
          </div>
        )}

        {/* Tableau principal */}
        {!loadingIssues && !issuesError && filteredIssues.length > 0 && (
          <VirtualIssueTable
            issues={filteredIssues}
            comments={comments}
            selectedIteration={selectedIteration}
            onCommentSaved={handleCommentSaved}
            onCommentDeleted={handleCommentDeleted}
            tableWrapperRef={tableWrapperRef}
            columnOrder={columnOrder}
            onReorder={setColumnOrder}
          />
        )}
      </div>
    </div>
  );
}
