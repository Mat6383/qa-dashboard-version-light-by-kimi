import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '../hooks/queries/useAnalytics';
import { trpc } from '../trpc/client';
import { Brain, CheckCircle, AlertTriangle, TrendingDown, Lightbulb, X } from 'lucide-react';

const typeIcons: Record<string, React.ReactNode> = {
  trend: <TrendingDown size={16} />,
  pattern: <AlertTriangle size={16} />,
  recommendation: <Lightbulb size={16} />,
  anomaly: <AlertTriangle size={16} />,
};

const typeColors: Record<string, string> = {
  trend: 'var(--text-warning)',
  pattern: 'var(--text-secondary)',
  recommendation: 'var(--text-success)',
  anomaly: 'var(--text-danger)',
};

export default function AnalyticsPanel({ projectId, isDark }: { projectId?: number; isDark: boolean }) {
  const { t } = useTranslation();
  const { insights, isLoading } = useAnalytics(projectId);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const markRead = trpc.analytics.markRead.useMutation();
  const markAllRead = trpc.analytics.markAllRead.useMutation();
  const analyze = trpc.analytics.analyze.useMutation();
  const utils = trpc.useUtils();

  const filtered = unreadOnly ? insights.filter((i) => !i.read) : insights;
  const unreadCount = insights.filter((i) => !i.read).length;

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id }, { onSuccess: () => utils.analytics.list.invalidate() });
  };

  const handleMarkAll = () => {
    markAllRead.mutate(projectId ? { projectId } : undefined, {
      onSuccess: () => utils.analytics.list.invalidate(),
    });
  };

  const handleAnalyze = () => {
    if (!projectId) return;
    analyze.mutate({ projectId }, { onSuccess: () => utils.analytics.list.invalidate() });
  };

  return (
    <div className={`analytics-panel ${isDark ? 'dark' : ''}`} style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={24} color="#8B5CF6" />
          {t('analytics.title', 'Analytics & Insights IA')}
          {unreadCount > 0 && (
            <span className="badge" style={{ background: 'var(--text-danger)', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12 }}>
              {unreadCount}
            </span>
          )}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setUnreadOnly((v) => !v)} type="button">
            {unreadOnly ? t('analytics.showAll', 'Tout afficher') : t('analytics.unreadOnly', 'Non lus')}
          </button>
          <button className="btn-secondary" onClick={handleMarkAll} type="button">
            <CheckCircle size={14} /> {t('analytics.markAllRead', 'Tout lire')}
          </button>
          {projectId && (
            <button className="btn-primary" onClick={handleAnalyze} disabled={analyze.isPending} type="button">
              {t('analytics.analyze', 'Analyser')}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p>{t('app.loadingMetrics')}</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>{t('analytics.empty', 'Aucun insight pour le moment.')}</p>
      ) : (
        <div className="insights-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((insight) => (
            <div
              key={insight.id}
              className={`insight-card ${insight.read ? 'read' : 'unread'}`}
              style={{
                background: 'var(--surface-muted)',
                borderLeft: `4px solid ${typeColors[insight.type] || 'var(--text-muted)'}`,
                borderRadius: 8,
                padding: 16,
                color: insight.read ? 'var(--text-secondary)' : 'var(--text-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {typeIcons[insight.type]}
                  <strong>{insight.title}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {Math.round(insight.confidence * 100)}% {t('analytics.confidence', 'confiance')}
                  </span>
                </div>
                {!insight.read && (
                  <button className="btn-icon" onClick={() => handleMarkRead(insight.id)} title={t('analytics.markRead', 'Marquer comme lu')} type="button">
                    <X size={16} />
                  </button>
                )}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 14 }}>{insight.message}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {new Date(insight.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
