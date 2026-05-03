import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Edit2, Check, X, Webhook } from 'lucide-react';

const EVENTS = ['feature-flag.changed', 'metric.alert'];
const METRICS = ['completionRate', 'passRate', 'failureRate', 'blockedRate', 'escapeRate', 'detectionRate', 'testEfficiency'];
const SEVERITIES = ['warning', 'critical'];

export default function WebhookSubscriptions({ isDark, subscriptions, onCreate, onUpdate, onDelete }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ url: '', events: [], secret: '', filters: null });

  const cardStyle = {
    backgroundColor: 'var(--surface-muted)',
    border: `1px solid ${'var(--border-color)'}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: `1px solid ${'var(--border-color)'}`,
    backgroundColor: 'var(--surface-default)',
    color: 'var(--text-color)',
    marginBottom: '8px',
    fontSize: '0.875rem',
  };

  const startEdit = (sub = null) => {
    if (sub) {
      setEditing(sub.id);
      setForm({ url: sub.url, events: sub.events, secret: sub.secret, filters: sub.filters });
    } else {
      setEditing('new');
      setForm({ url: '', events: ['metric.alert'], secret: '', filters: { metric: '', severity: '' } });
    }
  };

  const save = async () => {
    const data = {
      url: form.url,
      events: form.events,
      secret: form.secret,
      filters: form.events.includes('metric.alert') && form.filters
        ? {
            metric: form.filters.metric || undefined,
            severity: form.filters.severity || undefined,
          }
        : null,
    };
    if (editing === 'new') {
      await onCreate(data);
    } else {
      await onUpdate(editing, data);
    }
    setEditing(null);
    setForm({ url: '', events: [], secret: '', filters: null });
  };

  const showFilters = form.events.includes('metric.alert');

  const renderForm = () => (
    <div style={{ width: '100%' }}>
      <input style={inputStyle} placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
      <select
        multiple
        style={{ ...inputStyle, minHeight: '60px' }}
        value={form.events}
        onChange={(e) => {
          const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
          setForm({ ...form, events: opts });
        }}
      >
        {EVENTS.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
      {showFilters && (
        <>
          <select
            style={inputStyle}
            value={form.filters?.metric || ''}
            onChange={(e) => setForm({ ...form, filters: { ...form.filters, metric: e.target.value } })}
          >
            <option value="">{t('webhooks.allMetrics') || 'Toutes les métriques'}</option>
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            style={inputStyle}
            value={form.filters?.severity || ''}
            onChange={(e) => setForm({ ...form, filters: { ...form.filters, severity: e.target.value } })}
          >
            <option value="">{t('webhooks.allSeverities') || 'Toutes les sévérités'}</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </>
      )}
      <input style={inputStyle} type="password" placeholder="Secret" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button className="btn-toggle" onClick={save} type="button">
          <Check size={16} />
        </button>
        <button className="btn-toggle" onClick={() => setEditing(null)} type="button">
          <X size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <button className="btn-toggle" onClick={() => startEdit()} type="button">
          <Plus size={16} /> {t('webhooks.add') || 'Ajouter'}
        </button>
      </div>

      {editing === 'new' && <div style={{ ...cardStyle, display: 'block' }}>{renderForm()}</div>}

      {subscriptions.map((sub) => (
        <div key={sub.id} style={{ ...cardStyle, display: 'block' }}>
          {editing === sub.id ? (
            renderForm()
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Webhook size={14} /> {sub.url}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {sub.events.join(', ')}
                  {sub.filters && <span> | {JSON.stringify(sub.filters)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-toggle" onClick={() => startEdit(sub)} type="button">
                  <Edit2 size={14} />
                </button>
                <button className="btn-toggle" onClick={() => onDelete(sub.id)} type="button">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
