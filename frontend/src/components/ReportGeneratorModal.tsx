import React, { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  X, FileText, Download, Plus, Trash2, Activity, CheckSquare,
  FileSpreadsheet, Globe, Pencil, ChevronDown
} from 'lucide-react';
import apiService from '../services/api.service';
import { unwrapApiResponse } from '../types/api.types';
import '../styles/ReportGeneratorModal.css';
import { useTranslation } from 'react-i18next';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';

const RECO_TYPE_KEYS = [
  'observation', 'risk', 'recommendation', 'proposedAction', 'decidedAction', 'implementedAction', 'lessonsLearned',
];

const RECO_STATUS_KEYS = [
  'toAnalyze', 'toArbitrate', 'notRetained', 'planned', 'inProgress', 'completed', 'toReevaluate',
];

const PRIORITY_KEYS = ['high', 'medium', 'low'];

const getDefaultRecommendations = (t) => [
  { id: 1, category: t('reportGenerator.defaultReco.1.category'), text: t('reportGenerator.defaultReco.1.text'), type: ['proposedAction'], statut: 'planned', priority: 'high' },
  { id: 2, category: t('reportGenerator.defaultReco.2.category'), text: t('reportGenerator.defaultReco.2.text'), type: ['proposedAction'], statut: 'toArbitrate', priority: 'high' },
  { id: 3, category: t('reportGenerator.defaultReco.3.category'), text: t('reportGenerator.defaultReco.3.text'), type: ['recommendation'], statut: 'toAnalyze', priority: 'medium' },
  { id: 4, category: t('reportGenerator.defaultReco.4.category'), text: t('reportGenerator.defaultReco.4.text'), type: ['recommendation'], statut: 'toAnalyze', priority: 'medium' },
];

const ReportGeneratorModal = ({ isOpen, onClose, metrics, project, isDark }) => {
  const modalRef = useFocusTrap(isOpen);
  const { t, i18n } = useTranslation();
  const [formats, setFormats] = useState({ html: true, pptx: true });
  const [recommendations, setRecommendations] = useState(() => getDefaultRecommendations(t));
  const [complement, setComplement] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState(null);
  const [nextId, setNextId] = useState(5);
  const [openTypeDropdown, setOpenTypeDropdown] = useState(null);
  const typeDropdownRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGenerating(false);
      setGenerated(null);
      setError(null);
    }
  }, [isOpen]);

  // Close type dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setOpenTypeDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Extract milestone info from metrics
  const runs = metrics?.runs || [];
  const milestoneName = (() => {
    const standardRuns = runs.filter(r => !r.isExploratory);
    if (standardRuns.length > 0) {
      const match = standardRuns[0]?.name?.match(/R\d+[a-zA-Z]?/i);
      return match ? match[0] : 'Release';
    }
    return 'Release';
  })();

  // Envoyer les IDs des runs réels (pas les sessions "session-X") au backend
  const runIds = runs
    .filter(r => !String(r.id).startsWith('session-'))
    .map(r => r.id);
  const projectId = project?.id || 1;

  const totalTests = runs.reduce((s, r) => s + (r.total || 0), 0);
  const totalPassed = runs.reduce((s, r) => s + (r.passed || 0), 0);
  const totalFailed = runs.reduce((s, r) => s + (r.failed || 0), 0);

  // Recommendations handlers
  const updateReco = (id, field, value) => {
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteReco = (id) => {
    setRecommendations(prev => prev.filter(r => r.id !== id));
  };

  const addReco = () => {
    setRecommendations(prev => [...prev, {
      id: nextId,
      category: '',
      text: '',
      type: ['recommendation'],
      statut: 'toAnalyze',
      priority: 'medium',
    }]);
    setNextId(n => n + 1);
  };

  // Download helper
  const downloadBase64 = (base64, filename, mimeType) => {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate
  const handleGenerate = async () => {
    // Garde : vérifier que des runs sont disponibles
    if (!runIds || runIds.length === 0) {
      setError(t('reportGenerator.noRunError'));
      return;
    }
    if (!projectId) {
      setError(t('reportGenerator.noProjectError'));
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const response = await apiService.generateReport({
        projectId,
        runIds,
        formats,
        recommendations: recommendations.filter(r => r.text.trim()).map(r => r.text.trim()),
        complement: complement.trim(),
        lang: i18n.language === 'fr' || i18n.language === 'en' ? i18n.language : 'fr',
      });
      setGenerated(unwrapApiResponse(response));
    } catch (err) {
      setError(err.message || t('reportGenerator.genericError'));
    } finally {
      setGenerating(false);
    }
  };

  useGlobalShortcuts({
    onClose: isOpen ? onClose : undefined,
    onSave: isOpen ? handleGenerate : undefined,
  });

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="rgm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-gen-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`rgm-modal ${isDark ? 'dark-theme' : ''}`}>
        {/* Header */}
        <div className="rgm-header">
          <h2 id="report-gen-title"><FileText size={20} /> {t('reportGenerator.title')}</h2>
          <button data-modal-close className="rgm-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="rgm-body">
          {/* === STEP 1: Milestone & Runs === */}
          <div className="rgm-step">
            <div className="rgm-step-title">
              <span className="rgm-step-num">1</span>
              {t('reportGenerator.step1Title', { milestone: milestoneName })}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              <span><strong>{runIds.length}</strong> {t('reportGenerator.runsIncluded', { count: runIds.length, plural: runIds.length > 1 ? 's' : '' })}</span>
              <span style={{ color: 'var(--text-success)' }}><strong>{totalPassed}</strong> {t('reportGenerator.passed')}</span>
              <span style={{ color: 'var(--text-danger)' }}><strong>{totalFailed}</strong> {t('reportGenerator.failed')}</span>
              <span><strong>{totalTests}</strong> {t('reportGenerator.totalTests')}</span>
            </div>
            {runIds.length === 0 && (
              <div style={{ background: 'var(--action-warning-surface)', border: '1px solid var(--action-warning-border)', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: 'var(--action-warning-text)', marginBottom: '0.5rem' }}>
                ⚠️ {t('reportGenerator.noStandardRunWarning')}
              </div>
            )}
            <div className="rgm-runs-grid">
              {runs.map((run, i) => {
                const passed = run.success_count || run.passed || 0;
                const failed = run.failure_count || run.failed || 0;
                const total = run.total_count || run.total || 0;
                const rate = total > 0 ? Math.round(passed / total * 100) : 0;
                return (
                  <div key={run.id || i} className="rgm-run-card">
                    <strong>{run.name}</strong>
                    <div className="rgm-run-stats">
                      <span className="pass">{passed}P</span>
                      {failed > 0 && <span className="fail">{failed}F</span>}
                      <span>{rate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* === STEP 2: Format selection === */}
          <div className="rgm-step">
            <div className="rgm-step-title">
              <span className="rgm-step-num">2</span>
              {t('reportGenerator.step2Title')}
            </div>
            <div className="rgm-formats">
              <label className={`rgm-format-option ${formats.html ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={formats.html}
                  onChange={(e) => setFormats(f => ({ ...f, html: e.target.checked }))}
                />
                <div>
                  <div className="rgm-format-label"><Globe size={14} style={{ display: 'inline', marginRight: 4 }} />HTML</div>
                  <div className="rgm-format-desc">{t('reportGenerator.htmlDesc')}</div>
                </div>
              </label>
              <label className={`rgm-format-option ${formats.pptx ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={formats.pptx}
                  onChange={(e) => setFormats(f => ({ ...f, pptx: e.target.checked }))}
                />
                <div>
                  <div className="rgm-format-label"><FileSpreadsheet size={14} style={{ display: 'inline', marginRight: 4 }} />PowerPoint</div>
                  <div className="rgm-format-desc">{t('reportGenerator.pptxDesc')}</div>
                </div>
              </label>
            </div>
          </div>

          {/* === STEP 3: Recommendations editor === */}
          <div className="rgm-step">
            <div className="rgm-step-title">
              <span className="rgm-step-num">3</span>
              {t('reportGenerator.step3Title')} <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>({t('reportGenerator.leanItil')})</span>
            </div>
            <div className="rgm-reco-list">
              {recommendations.map((reco) => (
                <div key={reco.id} className="rgm-reco-item">
                  <div className="rgm-reco-inputs">
                    <div className="rgm-reco-row">
                      <input
                        className="rgm-reco-cat"
                        value={reco.category}
                        onChange={(e) => updateReco(reco.id, 'category', e.target.value)}
                        placeholder={t('reportGenerator.categoryPlaceholder')}
                      />
                      <div
                        className="rgm-reco-type-dropdown"
                        ref={openTypeDropdown === reco.id ? typeDropdownRef : null}
                      >
                        <div
                          className="rgm-reco-type-trigger"
                          title={t("reportGenerator.typePlaceholder")}
                          onClick={() => setOpenTypeDropdown(openTypeDropdown === reco.id ? null : reco.id)}
                        >
                          <span className="rgm-reco-type-label">
                            {(Array.isArray(reco.type) ? reco.type : reco.type ? [reco.type] : []).length === 0
                              ? t('reportGenerator.typePlaceholder')
                              : (Array.isArray(reco.type) ? reco.type : [reco.type]).map(k => t(`reportGenerator.recoTypes.${k}`)).join(', ')}
                          </span>
                          <ChevronDown size={11} />
                        </div>
                        {openTypeDropdown === reco.id && (
                          <div className="rgm-reco-type-menu">
                            {RECO_TYPE_KEYS.map(typeKey => {
                              const current = Array.isArray(reco.type) ? reco.type : reco.type ? [reco.type] : [];
                              const checked = current.includes(typeKey);
                              return (
                                <label key={typeKey} className="rgm-reco-type-option">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...current, typeKey]
                                        : current.filter(x => x !== typeKey);
                                      updateReco(reco.id, 'type', next);
                                    }}
                                  />
                                  {t(`reportGenerator.recoTypes.${typeKey}`)}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <select
                        className="rgm-reco-priority"
                        value={reco.statut || 'toAnalyze'}
                        onChange={(e) => updateReco(reco.id, 'statut', e.target.value)}
                        title={t("reportGenerator.statusTitle")}
                      >
                        {RECO_STATUS_KEYS.map(s => <option key={s} value={s}>{t(`reportGenerator.recoStatuses.${s}`)}</option>)}
                      </select>
                      <select
                        className="rgm-reco-priority"
                        value={reco.priority}
                        onChange={(e) => updateReco(reco.id, 'priority', e.target.value)}
                        title={t("reportGenerator.priorityTitle")}
                      >
                        {PRIORITY_KEYS.map(p => <option key={p} value={p}>{t(`reportGenerator.priorities.${p}`)}</option>)}
                      </select>
                    </div>
                    <textarea
                      className="rgm-reco-text"
                      value={reco.text}
                      onChange={(e) => updateReco(reco.id, 'text', e.target.value)}
                      placeholder={t('reportGenerator.recoPlaceholder')}
                      rows={2}
                    />
                  </div>
                  <div className="rgm-reco-actions">
                    <button
                      className="rgm-btn-icon"
                      onClick={() => deleteReco(reco.id)}
                      title={t('reportGenerator.deleteTitle')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button className="rgm-add-btn" onClick={addReco}>
                <Plus size={16} /> {t('reportGenerator.addRecommendation')}
              </button>
            </div>
          </div>

          {/* === STEP 4: Complément d'information === */}
          <div className="rgm-step">
            <div className="rgm-step-title">
              <span className="rgm-step-num">4</span>
              {t('reportGenerator.step4Title')}
              <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginLeft: '0.5rem' }}>{t('reportGenerator.step4Optional')}</span>
            </div>
            <textarea
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              placeholder={t('reportGenerator.complementPlaceholder')}
              rows={5}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--bg-color, #f8fafc)',
                color: 'var(--text-color, #1e293b)',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.35rem' }}>
              {complement.length > 0 ? t('reportGenerator.charCount', { count: complement.length }) : t('reportGenerator.leaveEmpty')}
            </div>
          </div>

          {/* === Generation progress / results === */}
          {generating && (
            <div className="rgm-progress">
              <Activity size={36} className="spinner" color="#3b82f6" />
              <p style={{ color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                {t('reportGenerator.generating')}
              </p>
            </div>
          )}

          {error && (
            <div style={{ padding: '0.75rem', background: 'var(--badge-danger-bg)', border: '1px solid var(--badge-danger-border)', borderRadius: 8, color: 'var(--text-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <strong>{t('reportGenerator.errorLabel')}</strong> {error}
            </div>
          )}

          {generated && (
            <div>
              <div className="rgm-success">
                <CheckSquare size={18} style={{ display: 'inline', marginRight: 6 }} />
                {t('reportGenerator.reportGenerated', { milestone: generated.summary?.milestone, verdict: generated.summary?.verdict })}
                <br />
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                  {t('reportGenerator.statsLine', { totalTests: generated.summary?.totalTests, passRate: generated.summary?.passRate, failedTests: generated.summary?.failedTests })}
                </span>
              </div>
              <div className="rgm-downloads">
                {generated.files?.html && (
                  <button
                    className="rgm-dl-btn"
                    onClick={() => downloadBase64(generated.files.html, generated.files.htmlFilename, 'text/html')}
                  >
                    <Download size={16} /> {t('reportGenerator.downloadHtml')}
                  </button>
                )}
                {generated.files?.pptx && (
                  <button
                    className="rgm-dl-btn"
                    onClick={() => downloadBase64(generated.files.pptx, generated.files.pptxFilename, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')}
                  >
                    <Download size={16} /> {t('reportGenerator.downloadPptx')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!generated && (
          <div className="rgm-footer">
            <button className="rgm-btn-cancel" onClick={onClose}>{t('common.cancel')}</button>
            <button
              className="rgm-btn-generate"
              onClick={handleGenerate}
              disabled={generating || (!formats.html && !formats.pptx)}
            >
              {generating ? (
                <><Activity size={16} className="spinner" /> {t('reportGenerator.generating')}</>
              ) : (
                <><FileText size={16} /> {t('reportGenerator.generateBtn')}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportGeneratorModal;
