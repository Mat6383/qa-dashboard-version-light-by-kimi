import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Shield, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api.service';
import type { AuditLog } from '../types/api.types';
import { unwrapApiResponse } from '../types/api.types';
import { useColumnOrder } from '../hooks/useColumnOrder';
import SortableTableHeader from './SortableTableHeader';

const ACTION_KEY_MAP: Record<string, string> = {
  'cache.clear': 'cacheClear',
  'feature-flag.update': 'featureFlagUpdate',
  'sync.execute': 'syncExecute',
  'sync.config.update': 'syncConfigUpdate',
  'report.generate': 'reportGenerate',
  'export.csv': 'exportCsv',
  'export.excel': 'exportExcel',
  'export.pdf': 'exportPdf',
  'notification.settings.update': 'notificationSettingsUpdate',
  'notification.test': 'notificationTest',
  'rbac.denied': 'rbacDenied',
};

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatusBadge({ success, t }: { success: boolean; t: (key: string) => string }) {
  return (
    <span
      className="status-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: success ? 'color-mix(in srgb, var(--text-success) 15%, transparent)' : 'color-mix(in srgb, var(--text-danger) 15%, transparent)',
        color: success ? 'var(--text-success)' : 'var(--text-danger)',
      }}
    >
      {success ? t('auditLog.success') : t('auditLog.failure')}
    </span>
  );
}

export default function AuditLogViewer({ isDark }: { isDark: boolean }) {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

    const AUDIT_COLUMNS = [
    { key: 'timestamp', label: t('auditLog.timestamp') },
    { key: 'user', label: t('auditLog.user') },
    { key: 'action', label: t('auditLog.action') },
    { key: 'resource', label: t('auditLog.resource') },
    { key: 'methodPath', label: t('auditLog.methodPath') },
    { key: 'httpStatus', label: t('auditLog.httpStatus') },
    { key: 'result', label: t('auditLog.result') },
    { key: 'ip', label: t('auditLog.ip') },
  ];

  const { columnOrder, setColumnOrder } = useColumnOrder('audit', AUDIT_COLUMNS.map((c) => c.key));

  const [filters, setFilters] = useState<{
    action: string;
    from: string;
    to: string;
  }>({
    action: '',
    from: '',
    to: '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { limit, offset };
      if (filters.action) params.action = filters.action;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      const result = await apiService.getAuditLogs(params);
      setLogs(unwrapApiResponse(result));
      setTotal('total' in result ? result.total : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auditLog.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const themeStyles: Record<string, React.CSSProperties> = {
    container: {
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
      color: 'var(--text-color)',
    },
    card: {
      backgroundColor: 'var(--surface-default)',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: isDark ? '0 4px 6px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.05)',
      border: '1px solid var(--border-color)',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '20px',
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    filterRow: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
      flexWrap: 'wrap',
    },
    input: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      backgroundColor: 'var(--surface-default)',
      color: 'var(--text-color)',
      fontSize: '0.875rem',
    },
    select: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      backgroundColor: 'var(--surface-default)',
      color: 'var(--text-color)',
      fontSize: '0.875rem',
    },
    btnPrimary: {
      padding: '8px 16px',
      borderRadius: '8px',
      backgroundColor: 'var(--action-primary-bg)',
      color: 'var(--action-primary-text)',
      border: 'none',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '0.875rem',
    },
    th: {
      textAlign: 'left',
      padding: '12px',
      borderBottom: '2px solid var(--border-color)',
      fontWeight: 600,
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid var(--border-color)',
      verticalAlign: 'top',
    },
    pagination: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: '20px',
      fontSize: '0.875rem',
    },
    pageBtn: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: '1px solid var(--border-color)',
      backgroundColor: 'var(--surface-default)',
      color: 'var(--text-color)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
  };

  return (
    <div style={themeStyles.container}>
      <div style={themeStyles.card}>
        <div style={themeStyles.header}>
          <h2 style={themeStyles.title}>
            <Shield size={24} color="#3B82F6" />
            {t('auditLog.title')}
          </h2>
          <button style={themeStyles.btnPrimary} onClick={fetchLogs} disabled={loading} type="button">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            {t('auditLog.reload')}
          </button>
        </div>

        <div style={themeStyles.filterRow}>
          <Filter size={16} color="#9ca3af" />
          <select
            style={themeStyles.select}
            value={filters.action}
            onChange={(e) => {
              setOffset(0);
              setFilters((f) => ({ ...f, action: e.target.value }));
            }}
          >
            <option value="">{t('auditLog.allActions')}</option>
            {Object.entries(ACTION_KEY_MAP).map(([key, mapKey]) => (
              <option key={key} value={key}>
                {t(`auditLog.actions.${mapKey}`)}
              </option>
            ))}
          </select>
          <input
            type="date"
            data-testid="audit-date-from"
            style={themeStyles.input}
            value={filters.from}
            onChange={(e) => {
              setOffset(0);
              setFilters((f) => ({ ...f, from: e.target.value }));
            }}
            placeholder={t('auditLog.fromPlaceholder')}
          />
          <input
            type="date"
            data-testid="audit-date-to"
            style={themeStyles.input}
            value={filters.to}
            onChange={(e) => {
              setOffset(0);
              setFilters((f) => ({ ...f, to: e.target.value }));
            }}
            placeholder={t('auditLog.toPlaceholder')}
          />
        </div>

        {error && (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239,68,68,0.1)',
              color: 'var(--text-danger)',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={themeStyles.table}>
            <thead>
              <SortableTableHeader
                columns={AUDIT_COLUMNS}
                columnOrder={columnOrder}
                onReorder={setColumnOrder}
                tableId="audit"
              />
            </thead>
            <tbody>
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={columnOrder.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {t('auditLog.noEntries')}
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id}>
                  {columnOrder.map((colKey) => {
                    switch (colKey) {
                      case 'timestamp':
                        return <td key={colKey} style={themeStyles.td}>{formatDate(log.timestamp, i18n.language)}</td>;
                      case 'user':
                        return (
                          <td key={colKey} style={themeStyles.td}>
                            {log.actor_email ? (
                              <>
                                <div>{log.actor_email}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.actor_role}</div>
                              </>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        );
                      case 'action':
                        return (
                          <td key={colKey} style={themeStyles.td}>
                            <span style={{ fontWeight: 500 }}>{log.action && ACTION_KEY_MAP[log.action] ? t(`auditLog.actions.${ACTION_KEY_MAP[log.action]}`) : log.action}</span>
                          </td>
                        );
                      case 'resource':
                        return (
                          <td key={colKey} style={themeStyles.td}>
                            {log.resource}
                            {log.resource_id ? ` / ${log.resource_id}` : ''}
                          </td>
                        );
                      case 'methodPath':
                        return (
                          <td key={colKey} style={themeStyles.td}>
                            <code
                              style={{
                                fontSize: '0.75rem',
                                backgroundColor: 'var(--surface-muted)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {log.method}
                            </code>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{log.path}</div>
                          </td>
                        );
                      case 'httpStatus':
                        return <td key={colKey} style={themeStyles.td}>{log.status_code ?? '—'}</td>;
                      case 'result':
                        return (
                          <td key={colKey} style={themeStyles.td}>
                            <StatusBadge success={log.success} t={t} />
                          </td>
                        );
                      case 'ip':
                        return (
                          <td key={colKey} style={themeStyles.td}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.ip}</span>
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={themeStyles.pagination}>
            <button
              style={{ ...themeStyles.pageBtn, opacity: offset === 0 ? 0.5 : 1 }}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              disabled={offset === 0}
              type="button"
            >
              <ChevronLeft size={16} /> {t('auditLog.previous')}
            </button>
            <span>
              {t('auditLog.pageInfo', { currentPage, totalPages, total })}
            </span>
            <button
              style={{ ...themeStyles.pageBtn, opacity: offset + limit >= total ? 0.5 : 1 }}
              onClick={() => setOffset((o) => o + limit)}
              disabled={offset + limit >= total}
              type="button"
            >
              {t('auditLog.next')} <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
