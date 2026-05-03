/**
 * ================================================
 * FEATURE FLAGS ADMIN — CRUD + Rollout %
 * ================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ToggleLeft,
  ToggleRight,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  SlidersHorizontal,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { trpc } from '../trpc/client';
import { useCreateFeatureFlag, useUpdateFeatureFlag, useDeleteFeatureFlag } from '../hooks/mutations/useFeatureFlags';
import type { FeatureFlag } from '../types/api.types';

function formatDate(iso: string | null | undefined, lng: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString(lng === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface FeatureFlagsAdminProps {
  isDark: boolean;
}

export default function FeatureFlagsAdmin({ isDark }: FeatureFlagsAdminProps) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);

  const [form, setForm] = useState({
    key: '',
    enabled: false,
    description: '',
    rolloutPercentage: 100,
  });

  const { data: flagsData, isLoading: loading, refetch: refetchFlags } = trpc.featureFlags.listAdmin.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const flags = (flagsData?.data?.flags || []) as FeatureFlag[];

  const openCreate = () => {
    setEditingFlag(null);
    setForm({ key: '', enabled: false, description: '', rolloutPercentage: 100 });
    setModalOpen(true);
  };

  const openEdit = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setForm({
      key: flag.key,
      enabled: flag.enabled,
      description: flag.description || '',
      rolloutPercentage: flag.rolloutPercentage ?? 100,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingFlag(null);
  };

  const createMutation = useCreateFeatureFlag();
  const updateMutation = useUpdateFeatureFlag();
  const deleteMutation = useDeleteFeatureFlag();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingFlag) {
        await updateMutation.mutateAsync({ key: editingFlag.key, enabled: form.enabled, description: form.description, rolloutPercentage: form.rolloutPercentage });
        showToast(t('featureFlags.updated'), 'success');
      } else {
        await createMutation.mutateAsync({ key: form.key, enabled: form.enabled, description: form.description, rolloutPercentage: form.rolloutPercentage });
        showToast(t('featureFlags.created'), 'success');
      }
      closeModal();
      refetchFlags();
    } catch (err: any) {
      showToast(err.message || t('featureFlags.saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(t('featureFlags.confirmDelete', { key }))) return;
    try {
      await deleteMutation.mutateAsync({ key });
      showToast(t('featureFlags.deleted'), 'success');
      refetchFlags();
    } catch (err: any) {
      showToast(err.message || t('featureFlags.deleteError'), 'error');
    }
  };

  const handleToggleEnabled = async (flag: FeatureFlag) => {
    try {
      await updateMutation.mutateAsync({ key: flag.key, enabled: !flag.enabled });
      showToast(t('featureFlags.toggled', { key: flag.key, state: !flag.enabled ? t('common.enabled') : t('common.disabled') }), 'success');
    } catch (err: any) {
      showToast(t('featureFlags.toggleError'), 'error');
    }
  };

  const handleRolloutChange = async (flag: FeatureFlag, value: string) => {
    const num = Math.min(100, Math.max(0, Number(value)));
    try {
      await updateMutation.mutateAsync({ key: flag.key, rolloutPercentage: num });
    } catch (err: any) {
      showToast(t('featureFlags.rolloutError'), 'error');
    }
  };

  const theme: Record<string, React.CSSProperties> = {
    container: {
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      color: 'var(--text-color)',
    },
    card: {
      backgroundColor: 'var(--surface-default)',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: isDark ? '0 4px 6px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.05)',
      border: `1px solid ${'var(--border-color)'}`,
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
    btnPrimary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: 'var(--text-primary)',
      color: '#fff',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.875rem',
    },
    btnSecondary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      borderRadius: '8px',
      border: `1px solid ${'var(--border-color)'}`,
      backgroundColor: 'var(--surface-muted)',
      color: 'var(--text-color)',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.875rem',
    },
    btnDanger: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '6px',
      border: 'none',
      backgroundColor: 'var(--text-danger)',
      color: '#fff',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.75rem',
    },
    btnIcon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      borderRadius: '6px',
      border: `1px solid ${'var(--border-color)'}`,
      backgroundColor: 'transparent',
      color: 'var(--text-muted)',
      cursor: 'pointer',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '0.875rem',
    },
    th: {
      textAlign: 'left',
      padding: '12px 16px',
      borderBottom: `2px solid ${'var(--border-color)'}`,
      fontWeight: 600,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      fontSize: '0.75rem',
      letterSpacing: '0.05em',
    },
    td: {
      padding: '12px 16px',
      borderBottom: `1px solid ${'var(--surface-muted)'}`,
      verticalAlign: 'middle',
    },
    toggleBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      display: 'inline-flex',
      alignItems: 'center',
    },
    slider: {
      width: '120px',
      accentColor: 'var(--text-primary)',
    },
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    },
    modal: {
      backgroundColor: 'var(--surface-default)',
      borderRadius: '12px',
      padding: '24px',
      width: '100%',
      maxWidth: '480px',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
      border: `1px solid ${'var(--border-color)'}`,
    },
    input: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: `1px solid ${'var(--border-color)'}`,
      backgroundColor: 'var(--surface-default)',
      color: 'var(--text-color)',
      fontSize: '0.875rem',
      marginTop: '4px',
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: 500,
      marginBottom: '4px',
      color: 'var(--text-color)',
    },
    formGroup: {
      marginBottom: '16px',
    },
    emptyState: {
      textAlign: 'center',
      padding: '48px 24px',
      color: 'var(--text-muted)',
    },
  };

  return (
    <div style={theme.container}>
      <div style={theme.card}>
        <div style={theme.header}>
          <h1 style={theme.title}>
            <SlidersHorizontal size={24} color="#3B82F6" />
            {t('featureFlags.title')}
          </h1>
          <button style={theme.btnPrimary} onClick={openCreate} type="button">
            <Plus size={16} />
            {t('featureFlags.newFlag')}
          </button>
        </div>

        {loading && flags.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader2 size={32} className="spinning" color="#3B82F6" />
          </div>
        ) : flags.length === 0 ? (
          <div style={theme.emptyState}>
            <AlertTriangle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>{t('featureFlags.empty')}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={theme.table}>
              <thead>
                <tr>
                  <th style={theme.th}>{t('featureFlags.flag')}</th>
                  <th style={theme.th}>{t('featureFlags.description')}</th>
                  <th style={theme.th}>{t('featureFlags.active')}</th>
                  <th style={theme.th}>{t('featureFlags.rollout')}</th>
                  <th style={theme.th}>{t('featureFlags.createdAt')}</th>
                  <th style={theme.th}>{t('featureFlags.updatedAt')}</th>
                  <th style={{ ...theme.th, width: '100px' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.key}>
                    <td style={theme.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <code
                          style={{
                            backgroundColor: isDark ? 'var(--text-color)' : '#f3f4f6',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}
                        >
                          {flag.key}
                        </code>
                        {flag.enabled &&
                          flag.rolloutPercentage != null &&
                          flag.rolloutPercentage > 0 &&
                          flag.rolloutPercentage < 100 && (
                            <span
                              title={t('featureFlags.rolloutTooltip', { percentage: flag.rolloutPercentage })}
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: 'var(--action-warning-text)',
                                backgroundColor: 'var(--action-warning-surface)',
                                padding: '1px 6px',
                                borderRadius: '999px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {t('featureFlags.betaBadge', { percentage: flag.rolloutPercentage })}
                            </span>
                          )}
                      </div>
                    </td>
                    <td style={theme.td}>{flag.description || '-'}</td>
                    <td style={theme.td}>
                      <button
                        style={theme.toggleBtn}
                        onClick={() => handleToggleEnabled(flag)}
                        title={flag.enabled ? t('common.disable') : t('common.enable')}
                        type="button"
                      >
                        {flag.enabled ? (
                          <ToggleRight size={24} color="var(--text-success)" />
                        ) : (
                          <ToggleLeft size={24} color="var(--text-muted)" />
                        )}
                      </button>
                    </td>
                    <td style={theme.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={flag.rolloutPercentage ?? 100}
                          style={theme.slider}
                          onChange={(e) => handleRolloutChange(flag, e.target.value)}
                          disabled={!flag.enabled}
                        />
                        <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '36px' }}>
                          {flag.rolloutPercentage ?? 100}%
                        </span>
                      </div>
                    </td>
                    <td style={theme.td}>{formatDate(flag.createdAt, i18n.language)}</td>
                    <td style={theme.td}>{formatDate(flag.updatedAt, i18n.language)}</td>
                    <td style={theme.td}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={theme.btnIcon} onClick={() => openEdit(flag)} title={t('common.edit')} type="button">
                          <Pencil size={14} />
                        </button>
                        <button
                          style={{ ...theme.btnIcon, color: 'var(--text-danger)' }}
                          onClick={() => handleDelete(flag.key)}
                          title={t('common.delete')}
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Create / Edit */}
      {modalOpen && (
        <div style={theme.modalOverlay} onClick={closeModal}>
          <div style={theme.modal} onClick={(e) => e.stopPropagation()}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}
            >
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                {editingFlag ? t('featureFlags.editFlag') : t('featureFlags.newFlag')}
              </h2>
              <button style={{ ...theme.btnIcon, border: 'none' }} onClick={closeModal} type="button">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={theme.formGroup}>
                <label style={theme.label}>{t('featureFlags.key')}</label>
                <input
                  style={theme.input}
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  placeholder={t('featureFlags.keyPlaceholder')}
                  required
                  disabled={!!editingFlag}
                />
              </div>

              <div style={theme.formGroup}>
                <label style={theme.label}>{t('featureFlags.description')}</label>
                <input
                  style={theme.input}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t('featureFlags.descriptionPlaceholder')}
                />
              </div>

              <div style={theme.formGroup}>
                <label style={theme.label}>{t('featureFlags.active')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    style={theme.toggleBtn}
                    onClick={() => setForm({ ...form, enabled: !form.enabled })}
                  >
                    {form.enabled ? (
                      <ToggleRight size={28} color="#10B981" />
                    ) : (
                      <ToggleLeft size={28} color="#9CA3AF" />
                    )}
                  </button>
                  <span style={{ fontSize: '0.875rem' }}>{form.enabled ? t('common.yes') : t('common.no')}</span>
                </div>
              </div>

              <div style={theme.formGroup}>
                <label style={theme.label}>{t('featureFlags.rollout')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={form.rolloutPercentage}
                    style={theme.slider}
                    onChange={(e) => setForm({ ...form, rolloutPercentage: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.rolloutPercentage}
                    style={{ ...theme.input, width: '72px', marginTop: 0 }}
                    onChange={(e) => setForm({ ...form, rolloutPercentage: Number(e.target.value) })}
                  />
                  <span style={{ fontSize: '0.875rem' }}>%</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" style={theme.btnSecondary} onClick={closeModal}>
                  {t('common.cancel')}
                </button>
                <button type="submit" style={theme.btnPrimary} disabled={saving}>
                  {saving ? <Loader2 size={16} className="spinning" /> : <Save size={16} />}
                  {saving ? t('common.saving') : editingFlag ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
