import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRetentionPolicies, useRetentionArchives } from '../hooks/queries/useRetention';
import { trpc } from '../trpc/client';
import { Archive, Trash2, Play, Settings, Database } from 'lucide-react';

export default function RetentionAdmin({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();
  const { data: policies, isLoading } = useRetentionPolicies();
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const { data: archives } = useRetentionArchives(selectedType);
  const updatePolicy = trpc.retention.updatePolicy.useMutation();
  const runCycle = trpc.retention.runCycle.useMutation();
  const utils = trpc.useUtils();

  const handleUpdate = (entityType: string, field: string, value: any) => {
    updatePolicy.mutate(
      { entityType, [field]: value },
      { onSuccess: () => utils.retention.policies.invalidate() }
    );
  };

  return (
    <div className={`retention-admin ${isDark ? 'dark' : ''}`} style={{ padding: 24 }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <Database size={24} color="#3B82F6" />
        {t('retention.title', 'Data Retention & Archivage')}
      </h2>

      {isLoading ? (
        <p>{t('app.loadingMetrics')}</p>
      ) : (
        <>
          <section style={{ marginBottom: 32 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={18} /> {t('retention.policies', 'Politiques de rétention')}
            </h3>
            <table className="data-table" style={{ width: '100%', marginTop: 12 }}>
              <thead>
                <tr>
                  <th>{t('retention.entityType', 'Entité')}</th>
                  <th>{t('retention.retentionDays', 'Jours de rétention')}</th>
                  <th>{t('retention.autoArchive', 'Archivage auto')}</th>
                  <th>{t('retention.autoDelete', 'Suppression auto')}</th>
                </tr>
              </thead>
              <tbody>
                {policies?.map((p: any) => (
                  <tr key={p.entity_type}>
                    <td>{p.entity_type}</td>
                    <td>
                      <input
                        type="number"
                        value={p.retention_days}
                        min={1}
                        max={3650}
                        onChange={(e) => handleUpdate(p.entity_type, 'retentionDays', parseInt(e.target.value))}
                        style={{ width: 80 }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.auto_archive}
                        onChange={(e) => handleUpdate(p.entity_type, 'autoArchive', e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.auto_delete}
                        onChange={(e) => handleUpdate(p.entity_type, 'autoDelete', e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-primary" onClick={() => runCycle.mutate(undefined, { onSuccess: () => { utils.retention.policies.invalidate(); utils.retention.archives.invalidate(); } })} disabled={runCycle.isPending} type="button" style={{ marginTop: 12 }}>
              <Play size={14} /> {t('retention.runCycle', 'Lancer le cycle manuellement')}
            </button>
          </section>

          <section>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Archive size={18} /> {t('retention.archives', 'Archives')}
            </h3>
            <select value={selectedType || ''} onChange={(e) => setSelectedType(e.target.value || undefined)} style={{ margin: '12px 0' }}>
              <option value="">{t('retention.allTypes', 'Tous les types')}</option>
              <option value="metric_snapshots">metric_snapshots</option>
              <option value="sync_history">sync_history</option>
              <option value="audit_logs">audit_logs</option>
              <option value="analytics_insights">analytics_insights</option>
            </select>
            {archives && archives.length > 0 ? (
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t('retention.entityType', 'Type')}</th>
                    <th>Project ID</th>
                    <th>{t('retention.archivedAt', 'Archivé le')}</th>
                  </tr>
                </thead>
                <tbody>
                  {archives.map((a: any) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.entity_type}</td>
                      <td>{a.project_id ?? '-'}</td>
                      <td>{new Date(a.archived_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>{t('retention.noArchives', 'Aucune archive.')}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
