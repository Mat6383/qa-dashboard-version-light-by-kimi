import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntegrations } from '../hooks/queries/useIntegrations';
import { trpc } from '../trpc/client';
import { Plug, Plus, Trash2, TestTube, Globe, Webhook, CheckCircle, XCircle } from 'lucide-react';

const GitLabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
    <path d="M31.46 12.6l-2.1-6.47a1.1 1.1 0 00-2.1 0l-2.1 6.47H17.5l-2.1-6.47a1.1 1.1 0 00-2.1 0l-2.1 6.47H6.83L4.74 6.13a1.1 1.1 0 00-2.1 0L.54 12.6a1.42 1.42 0 000 1l4.4 13.54a1.1 1.1 0 001 .76h20.12a1.1 1.1 0 001-.76l4.4-13.54a1.42 1.42 0 000-1z"/>
  </svg>
);

const typeIcons: Record<string, React.ReactNode> = {
  jira: <Globe size={16} />,
  azure_devops: <Plug size={16} />,
  generic_webhook: <Webhook size={16} />,
  gitlab: <GitLabIcon />,
};

export default function IntegrationsAdmin({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();
  const { data: integrations, isLoading } = useIntegrations();
  const [showForm, setShowForm] = useState(false);
  const configTemplates: Record<string, string> = {
    jira: JSON.stringify({ baseUrl: 'https://jira.example.com', username: '', apiToken: '', projectKey: '' }, null, 2),
    azure_devops: JSON.stringify({ org: '', project: '', pat: '' }, null, 2),
    generic_webhook: JSON.stringify({ url: '', secret: '' }, null, 2),
    gitlab: JSON.stringify({ baseUrl: 'https://gitlab.example.com', token: '', projectId: '' }, null, 2),
  };

  const [form, setForm] = useState({ name: '', type: 'jira' as const, config: configTemplates['jira'], enabled: true });
  const create = trpc.integrations.create.useMutation();
  const deleteMutation = trpc.integrations.delete.useMutation();
  const testConnection = trpc.integrations.testConnection.useMutation();
  const utils = trpc.useUtils();

  const handleCreate = () => {
    try {
      const config = JSON.parse(form.config);
      create.mutate(
        { name: form.name, type: form.type, config, enabled: form.enabled },
        {
          onSuccess: () => {
            utils.integrations.list.invalidate();
            setShowForm(false);
            setForm({ name: '', type: 'jira', config: configTemplates['jira'], enabled: true });
          },
        }
      );
    } catch {
      alert('JSON invalide dans la configuration');
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm(t('integrations.confirmDelete', 'Supprimer cette intégration ?'))) return;
    deleteMutation.mutate({ id }, { onSuccess: () => utils.integrations.list.invalidate() });
  };

  return (
    <div className={`integrations-admin ${isDark ? 'dark' : ''}`} style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plug size={24} color="#10B981" />
          {t('integrations.title', 'Intégrations tierces')}
        </h2>
        <button className="btn-primary" onClick={() => setShowForm(true)} type="button">
          <Plus size={16} /> {t('integrations.add', 'Ajouter')}
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal" style={{ background: 'var(--surface-default)', padding: 24, borderRadius: 12, width: 480, maxWidth: '90vw' }}>
            <h3>{t('integrations.new', 'Nouvelle intégration')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              <input placeholder={t('integrations.name', 'Nom')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select
                value={form.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  setForm({ ...form, type: newType as any, config: configTemplates[newType] || '{}' });
                }}
              >
                <option value="jira">Jira</option>
                <option value="azure_devops">Azure DevOps</option>
                <option value="generic_webhook">Webhook générique</option>
                <option value="gitlab">GitLab</option>
              </select>
              <textarea placeholder="Config JSON" rows={6} value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                {t('integrations.enabled', 'Activée')}
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setShowForm(false)} type="button">{t('common.cancel', 'Annuler')}</button>
                <button className="btn-primary" onClick={handleCreate} disabled={!form.name || create.isPending} type="button">{t('common.create', 'Créer')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p>{t('app.loadingMetrics')}</p>
      ) : integrations && integrations.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {integrations.map((integration: any) => (
            <div key={integration.id} style={{ background: 'var(--surface-muted)', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {typeIcons[integration.type]}
                  <strong>{integration.name}</strong>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: integration.enabled ? 'color-mix(in srgb, var(--text-success) 15%, transparent)' : 'color-mix(in srgb, var(--text-danger) 15%, transparent)', color: integration.enabled ? 'var(--text-success)' : 'var(--text-danger)' }}>
                    {integration.enabled ? t('integrations.active', 'Active') : t('integrations.inactive', 'Inactive')}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  {integration.type} {integration.last_sync_at ? `— ${t('integrations.lastSync', 'Dernière synchro')}: ${new Date(integration.last_sync_at).toLocaleString()}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={() => testConnection.mutate({ id: integration.id })} disabled={testConnection.isPending} type="button">
                  <TestTube size={14} /> {t('integrations.test', 'Tester')}
                </button>
                <button className="btn-danger" onClick={() => handleDelete(integration.id)} type="button">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>{t('integrations.empty', 'Aucune intégration configurée.')}</p>
      )}

      {testConnection.data && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: testConnection.data.success ? 'color-mix(in srgb, var(--text-success) 15%, transparent)' : 'color-mix(in srgb, var(--text-danger) 15%, transparent)', color: testConnection.data.success ? 'var(--text-success)' : 'var(--text-danger)' }}>
          {testConnection.data.success ? <CheckCircle size={16} /> : <XCircle size={16} />} {testConnection.data.message}
        </div>
      )}
    </div>
  );
}
