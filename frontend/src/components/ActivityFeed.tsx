import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, RefreshCw, AlertTriangle, Radio, GitCommit } from 'lucide-react';
import { useSyncHistory } from '../hooks/queries';
import { useDashboard } from '../hooks/useDashboard';
import type { AnomalyItem } from '../types/api.types';

interface ActivityFeedProps {
  anomalies?: AnomalyItem[];
  lastLiveEventAt?: Date | null;
}

interface FeedItem {
  id: string;
  type: 'sync' | 'alert' | 'live' | 'anomaly';
  icon: React.ReactNode;
  color: string;
  title: string;
  time: string;
}

function formatTimeAgo(date: string | Date, lang: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return lang === 'fr' ? 'à l\'instant' : 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export default function ActivityFeed({ anomalies = [], lastLiveEventAt }: ActivityFeedProps) {
  const { t, i18n } = useTranslation();
  const { data: syncHistory = [] } = useSyncHistory();

  const items: FeedItem[] = useMemo(() => {
    const result: FeedItem[] = [];

    // Live event
    if (lastLiveEventAt) {
      result.push({
        id: 'live',
        type: 'live',
        icon: <Radio size={14} />,
        color: 'var(--text-success)',
        title: t('activity.liveUpdate', { defaultValue: 'Mise à jour temps réel' }),
        time: formatTimeAgo(lastLiveEventAt, i18n.language),
      });
    }

    // Sync events
    syncHistory.slice(0, 3).forEach((entry, idx) => {
      result.push({
        id: `sync-${idx}`,
        type: 'sync',
        icon: <GitCommit size={14} />,
        color: 'var(--text-primary)',
        title: `Sync ${entry.project_name}: ${entry.created} créés, ${entry.updated} mis à jour`,
        time: formatTimeAgo(entry.executed_at, i18n.language),
      });
    });

    // Anomalies
    anomalies.slice(0, 2).forEach((a, idx) => {
      result.push({
        id: `anomaly-${idx}`,
        type: 'anomaly',
        icon: <AlertTriangle size={14} />,
        color: a.severity === 'high' ? 'var(--text-danger)' : 'var(--text-warning)',
        title: `Anomalie ${a.metric}: z=${a.zScore}`,
        time: formatTimeAgo(a.timestamp, i18n.language),
      });
    });

    return result;
  }, [lastLiveEventAt, syncHistory, anomalies, t, i18n.language]);

  if (items.length === 0) {
    return (
      <div className="activity-feed activity-feed--empty">
        <Activity size={16} color="var(--text-muted)" />
        <span>{t('activity.noActivity', { defaultValue: 'Aucune activité récente' })}</span>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      <div className="activity-feed__header">
        <Activity size={14} />
        <span>{t('activity.title', { defaultValue: 'Activité récente' })}</span>
      </div>
      <div className="activity-feed__list">
        {items.map((item) => (
          <div key={item.id} className={`activity-feed__item activity-feed__item--${item.type}`}>
            <span className="activity-feed__icon" style={{ color: item.color }}>
              {item.icon}
            </span>
            <span className="activity-feed__title">{item.title}</span>
            <span className="activity-feed__time">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
