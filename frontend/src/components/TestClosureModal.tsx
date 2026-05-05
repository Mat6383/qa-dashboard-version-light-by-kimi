import React from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useToast } from '../hooks/useToast';
import {
  X,
  AlertTriangle,
  Bug,
  FileText,
  Download,
  Calendar,
  Layers,
  ShieldCheck,
  Activity,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTestClosure } from '../hooks/useTestClosure';
import TestClosurePDFTemplates from './TestClosurePDFTemplates';

const TestClosureModal = ({ isOpen, onClose, metrics, project, useBusiness, isDark }: any) => {
  const modalRef = useFocusTrap(isOpen);
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();

  const closure = useTestClosure({ isOpen, metrics, project, onClose, showToast, t });

  if (!isOpen) return null;

  return (
    <>
      <div
        ref={modalRef}
        className="closure-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-closure-title"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div
          className={`closure-modal-content ${isDark ? 'tv-dark-theme' : ''}`}
          style={{
            backgroundColor: 'var(--bg-color)',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* HEADER */}
          <div
            style={{
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--card-bg)',
            }}
          >
            <h2
              id="test-closure-title"
              style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.4rem' }}
            >
              <FileText size={28} color="var(--color-primary)" />
              {useBusiness ? t('testClosure.titleBusiness') : t('testClosure.titleStandard')}
            </h2>
            <button
              data-modal-close
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={28} />
            </button>
          </div>

          {/* BODY */}
          <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* ROW 1: Context */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('testClosure.versionLabel', { detected: useBusiness ? t('testClosure.detected') : 'Detected' })}
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--card-bg)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Layers size={18} color="var(--text-muted)" />
                  <input
                    type="text"
                    value={closure.version}
                    onChange={(e) => closure.setVersion(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-color)',
                      width: '100%',
                      outline: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('testClosure.environment')}
                </label>
                <input
                  type="text"
                  value={closure.environment}
                  onChange={(e) => closure.setEnvironment(e.target.value)}
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-color)',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    outline: 'none',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>

            {/* ROW 2: Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('testClosure.startDate')}
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--card-bg)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Calendar size={18} color="var(--text-muted)" />
                  <input
                    type="date"
                    value={closure.startDate}
                    onChange={(e) => closure.setStartDate(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-color)',
                      width: '100%',
                      outline: 'none',
                      fontSize: '1rem',
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('testClosure.endDate')}
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--card-bg)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Calendar size={18} color="var(--text-muted)" />
                  <input
                    type="date"
                    value={closure.endDate}
                    onChange={(e) => closure.setEndDate(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-color)',
                      width: '100%',
                      outline: 'none',
                      fontSize: '1rem',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Read-Only KPIs */}
            <div
              style={{
                background: 'var(--card-bg)',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px dashed var(--border-color)',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                }}
              >
                {t('testClosure.metricsReminder')}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('testClosure.execution')}</span>
                  <span
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      color: closure.m.completionRate >= 90 ? 'var(--text-success)' : 'var(--text-warning)',
                    }}
                  >
                    {closure.m.completionRate}%
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('testClosure.success')}</span>
                  <span
                    style={{ fontSize: '1.2rem', fontWeight: 700, color: closure.m.passRate >= 95 ? 'var(--text-success)' : 'var(--text-danger)' }}
                  >
                    {closure.m.passRate}%
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('testClosure.failures')}</span>
                  <span
                    style={{ fontSize: '1.2rem', fontWeight: 700, color: closure.m.failureRate <= 5 ? 'var(--text-success)' : 'var(--text-danger)' }}
                  >
                    {closure.m.failureRate}%
                  </span>
                </div>
              </div>
            </div>

            {/* Bugs Restants */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <label
                  style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Bug size={18} color="#EF4444" /> {t('testClosure.bugsTitle')}
                </label>
                <button
                  onClick={closure.addBug}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    background: 'var(--action-primary-bg)',
                    color: 'var(--action-primary-text)',
                    border: 'none',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  <Plus size={14} /> {t('testClosure.add')}
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: closure.bugs.length > 0 ? '0.75rem' : '0',
                }}
              >
                {closure.bugs.length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('testClosure.noBugs')}
                  </div>
                )}
                {closure.bugs.map((b, i) => (
                  <div key={b.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: '20px' }}>{i + 1}.</span>
                    <input
                      type="text"
                      placeholder={t('testClosure.bugPlaceholder')}
                      value={b.desc}
                      onChange={(e) => closure.updateBug(b.id, 'desc', e.target.value)}
                      style={{
                        flex: 1,
                        background: 'var(--bg-color)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-color)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        outline: 'none',
                      }}
                    />
                    <select
                      value={b.severity}
                      onChange={(e) => closure.updateBug(b.id, 'severity', e.target.value)}
                      style={{
                        background: 'var(--bg-color)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-color)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        outline: 'none',
                        width: '120px',
                      }}
                    >
                      <option value="Critique">{t('testClosure.critical')}</option>
                      <option value="Majeur">{t('testClosure.major')}</option>
                    </select>
                    <button
                      onClick={() => closure.removeBug(b.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-danger)',
                        cursor: 'pointer',
                        padding: '0.4rem',
                      }}
                      title={t('testClosure.deleteBug')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Décision GO/NOGO */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                <ShieldCheck size={18} color={closure.decisionColor} /> {t('testClosure.mainRecommendation')}
              </label>
              <select
                value={closure.decision}
                onChange={(e) => closure.setDecision(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--card-bg)',
                  border: `2px solid ${closure.decisionColor}`,
                  color: 'var(--text-color)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  outline: 'none',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                <option value="GO_PRODUCTION">{t('testClosure.goProduction')}</option>
                <option value="GO_RESERVE">{t('testClosure.goReserve')}</option>
                <option value="NO_GO">{t('testClosure.noGo')}</option>
              </select>
            </div>

            {/* Risques Résiduels */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                <AlertTriangle size={18} color="#F59E0B" /> {t('testClosure.residualRisks')}
              </label>
              <textarea
                placeholder={t('testClosure.residualRisksPlaceholder')}
                value={closure.residualRisks}
                onChange={(e) => closure.setResidualRisks(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  outline: 'none',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Sign-off */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
                {t('testClosure.signOffs')}
              </label>
              <textarea
                placeholder={t('testClosure.signOffsPlaceholder')}
                value={closure.signOffs}
                onChange={(e) => closure.setSignOffs(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  outline: 'none',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div
            style={{
              padding: '1.2rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              backgroundColor: 'var(--card-bg)',
            }}
          >
            <button
              onClick={onClose}
              disabled={closure.isExporting}
              style={{
                padding: '0.6rem 1.2rem',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: closure.isExporting ? 0.5 : 1,
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={closure.handleExport}
              disabled={closure.isExporting}
              style={{
                padding: '0.6rem 1.5rem',
                background: 'var(--color-primary)',
                border: 'none',
                color: 'white',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                opacity: closure.isExporting ? 0.7 : 1,
              }}
            >
              {closure.isExporting ? <Activity size={18} className="spinner" /> : <Download size={18} />}
              {closure.isExporting ? t('testClosure.generating') : t('testClosure.validateExport')}
            </button>
          </div>
        </div>
      </div>

      <TestClosurePDFTemplates
        pdfRefExec={closure.pdfRefExec}
        pdfRefDetails={closure.pdfRefDetails}
        commonPDFStyle={closure.commonPDFStyle}
        data={{
          t,
          language: i18n.language,
          project,
          version: closure.version,
          environment: closure.environment,
          startDate: closure.startDate,
          endDate: closure.endDate,
          decision: closure.decision,
          decisionColor: closure.decisionColor,
          isGo: closure.isGo,
          isGoReserve: closure.isGoReserve,
          residualRisks: closure.residualRisks,
          signOffs: closure.signOffs,
          bugs: closure.bugs,
          m: closure.m,
        }}
      />
    </>
  );
};

export default TestClosureModal;
