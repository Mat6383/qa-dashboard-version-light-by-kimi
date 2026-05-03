import React, { useState, useEffect, useRef } from 'react';
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
import '../styles/MetricsCards.css';
import { useExportPDF } from '../hooks/useExportPDF';
import { useTranslation } from 'react-i18next';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';

const TestClosureModal = ({ isOpen, onClose, metrics, project, useBusiness, isDark }) => {
  const modalRef = useFocusTrap(isOpen);
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  // === Form States ===
  const [version, setVersion] = useState('');
  const [environment, setEnvironment] = useState(t('testClosure.defaultEnvironment'));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [decision, setDecision] = useState('GO_PRODUCTION');
  const [residualRisks, setResidualRisks] = useState('');
  const [signOffs, setSignOffs] = useState('');
  const [bugs, setBugs] = useState([{ id: 1, desc: '', severity: 'Majeur' }]);

  const { exportPDF, isExporting } = useExportPDF({
    orientation: 'portrait',
    backgroundColor: '#FFFFFF',
    preCapture: true,
    multiPage: true,
  });
  const pdfRefExec = useRef(null);
  const pdfRefDetails = useRef(null);

  // === Default Values Calculation (Version & Dates) ===
  useEffect(() => {
    if (isOpen && metrics && metrics.runs) {
      // 1. Version Logic
      const standardRuns = metrics.runs.filter((r) => !r.isExploratory);
      if (standardRuns.length > 0) {
        // Extraire un pattern comme R06, R06j, R02, etc. depuis le nom du run
        const versionRegex = /R\d+[a-zA-Z]?/gi;
        let versionsFound = [];

        standardRuns.forEach((r) => {
          const matches = r.name.match(versionRegex);
          if (matches) {
            versionsFound.push(...matches);
          } else {
            versionsFound.push(r.name);
          }
        });

        // Tri intelligent (lettres identiques = tri sur chiffres)
        versionsFound.sort((a, b) => {
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        const highestVersion = versionsFound.length > 0 ? versionsFound[versionsFound.length - 1] : '';
        setVersion(highestVersion);
      } else {
        setVersion('');
      }

      // 2. Dates Logic
      if (metrics.runs.length > 0) {
        // Start date: earliest run
        const allDates = metrics.runs
          .map((r) => new Date(r.created_at))
          .filter((d) => !isNaN(d.getTime()))
          .sort((a, b) => a - b);

        if (allDates.length > 0) {
          setStartDate(allDates[0].toISOString().split('T')[0]);
        }

        // End date: last run with majority of test cases passed (passRate > 50)
        // Ensure standard Runs first if needed, but user says "dernier run une fois une majorité... passed"
        const runsMajorityPassed = metrics.runs
          .filter((r) => r.passRate > 50)
          .map((r) => new Date(r.created_at))
          .filter((d) => !isNaN(d.getTime()))
          .sort((a, b) => b - a); // Descending

        if (runsMajorityPassed.length > 0) {
          setEndDate(runsMajorityPassed[0].toISOString().split('T')[0]);
        } else if (allDates.length > 0) {
          // Fallback: very last run overall
          setEndDate(allDates[allDates.length - 1].toISOString().split('T')[0]);
        }
      }
    }
  }, [isOpen, metrics]);

  // === Bug List Handlers ===
  const addBug = () => setBugs([...bugs, { id: Date.now(), desc: '', severity: 'Majeur' }]);
  const removeBug = (id) => setBugs(bugs.filter((b) => b.id !== id));
  const updateBug = (id, field, value) => {
    setBugs(bugs.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  // === Export Logic ===
  const handleExport = async () => {
    try {
      await exportPDF(pdfRefExec.current, `1_Executive_Summary_${project?.name}_${version}.pdf`);
      await exportPDF(pdfRefDetails.current, `2_Rapport_Detaille_${project?.name}_${version}.pdf`);
      onClose(); // Fermer après l'export
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
      showToast(t('testClosure.exportError'), 'error');
    }
  };

  const m = metrics || { completionRate: 0, passRate: 0, failureRate: 0, testEfficiency: 0 };

  // Style dynamique selon le thème et la décision
  const isGo = decision === 'GO_PRODUCTION';
  const isGoReserve = decision === 'GO_RESERVE';
  const decisionColor = isGo ? 'var(--text-success)' : isGoReserve ? 'var(--text-warning)' : 'var(--text-danger)';

  const commonPDFStyle = {
    position: 'absolute',
    left: '-9999px',
    top: 0,
    width: '210mm',
    minHeight: '297mm',
    backgroundColor: '#FFFFFF',
    color: '#111827',
    padding: '20mm',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box',
  } satisfies React.CSSProperties;

  useGlobalShortcuts({
    onClose: isOpen ? onClose : undefined,
    onSave: isOpen ? handleExport : undefined,
  });

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
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
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
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
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
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
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
                      color: m.completionRate >= 90 ? 'var(--text-success)' : 'var(--text-warning)',
                    }}
                  >
                    {m.completionRate}%
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('testClosure.success')}</span>
                  <span
                    style={{ fontSize: '1.2rem', fontWeight: 700, color: m.passRate >= 95 ? 'var(--text-success)' : 'var(--text-danger)' }}
                  >
                    {m.passRate}%
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('testClosure.failures')}</span>
                  <span
                    style={{ fontSize: '1.2rem', fontWeight: 700, color: m.failureRate <= 5 ? 'var(--text-success)' : 'var(--text-danger)' }}
                  >
                    {m.failureRate}%
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
                  onClick={addBug}
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
                  padding: bugs.length > 0 ? '0.75rem' : '0',
                }}
              >
                {bugs.length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('testClosure.noBugs')}
                  </div>
                )}
                {bugs.map((b, i) => (
                  <div key={b.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: '20px' }}>{i + 1}.</span>
                    <input
                      type="text"
                      placeholder={t('testClosure.bugPlaceholder')}
                      value={b.desc}
                      onChange={(e) => updateBug(b.id, 'desc', e.target.value)}
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
                      onChange={(e) => updateBug(b.id, 'severity', e.target.value)}
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
                      onClick={() => removeBug(b.id)}
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
                <ShieldCheck size={18} color={decisionColor} /> {t('testClosure.mainRecommendation')}
              </label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--card-bg)',
                  border: `2px solid ${decisionColor}`,
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
                value={residualRisks}
                onChange={(e) => setResidualRisks(e.target.value)}
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
                value={signOffs}
                onChange={(e) => setSignOffs(e.target.value)}
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
              disabled={isExporting}
              style={{
                padding: '0.6rem 1.2rem',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: isExporting ? 0.5 : 1,
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
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
                opacity: isExporting ? 0.7 : 1,
              }}
            >
              {isExporting ? <Activity size={18} className="spinner" /> : <Download size={18} />}
              {isExporting ? t('testClosure.generating') : t('testClosure.validateExport')}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================
          PDF HIDDEN TEMPLATES 
          ========================================= */}

      {/* FORMAT 1: EXECUTIVE SUMMARY */}
      <div ref={pdfRefExec} style={{ ...commonPDFStyle, display: 'none' }}>
        <div
          style={{
            borderBottom: '3px solid #111827',
            paddingBottom: '10px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '24pt', color: '#111827' }}>{t('testClosure.pdfExecTitle')}</h1>
            <h2 style={{ margin: 0, fontSize: '14pt', color: '#4B5563', fontWeight: 'normal' }}>
              {t('testClosure.pdfProjectLabel')} {project?.name} | {t('testClosure.pdfVersionLabel')} {version}
            </h2>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10pt', color: '#6B7280' }}>
            {t('testClosure.pdfDateLabel')} {new Date().toLocaleDateString(i18n.language)}
          </div>
        </div>

        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '12pt', color: '#111827' }}>{t('testClosure.pdfContextTitle')}</h3>
          <p style={{ margin: '0 0 5px 0', fontSize: '10pt' }}>
            <strong>{t('testClosure.pdfEnvironmentLabel')}</strong> {environment}
          </p>
          <p style={{ margin: '0 0 5px 0', fontSize: '10pt' }}>
            <strong>{t('testClosure.pdfPeriodLabel')}</strong> {t('testClosure.pdfPeriodFromTo', { startDate, endDate })}
          </p>
        </div>

        <div
          style={{
            marginBottom: '20px',
            backgroundColor: isGo ? '#ECFDF5' : isGoReserve ? '#FFFBEB' : '#FEF2F2',
            padding: '20px',
            borderRadius: '8px',
            borderLeft: `6px solid ${decisionColor}`,
          }}
        >
          <h2 style={{ margin: '0 0 10px 0', fontSize: '16pt', color: decisionColor }}>
            {t('testClosure.pdfRecommendation', { decision: decision.replace('_', ' ') })}
          </h2>
          {residualRisks && (
            <div>
              <strong style={{ fontSize: '10pt' }}>{t('testClosure.pdfResidualRisks')}</strong>
              <p style={{ margin: '5px 0 0 0', fontSize: '10pt', whiteSpace: 'pre-wrap' }}>{residualRisks}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div
            style={{ flex: 1, padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', textAlign: 'center' }}
          >
            <div style={{ fontSize: '10pt', color: '#6B7280', textTransform: 'uppercase' }}>{t('testClosure.pdfExecutionRate')}</div>
            <div
              style={{ fontSize: '24pt', fontWeight: 'bold', color: m.completionRate >= 90 ? '#10B981' : '#F59E0B' }}
            >
              {m.completionRate}%
            </div>
          </div>
          <div
            style={{ flex: 1, padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', textAlign: 'center' }}
          >
            <div style={{ fontSize: '10pt', color: '#6B7280', textTransform: 'uppercase' }}>{t('testClosure.pdfSuccessRate')}</div>
            <div style={{ fontSize: '24pt', fontWeight: 'bold', color: m.passRate >= 95 ? '#10B981' : '#EF4444' }}>
              {m.passRate}%
            </div>
          </div>
          <div
            style={{ flex: 1, padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', textAlign: 'center' }}
          >
            <div style={{ fontSize: '10pt', color: '#6B7280', textTransform: 'uppercase' }}>{t('testClosure.pdfFailureRate')}</div>
            <div style={{ fontSize: '24pt', fontWeight: 'bold', color: m.failureRate <= 5 ? '#10B981' : '#EF4444' }}>
              {m.failureRate}%
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '5px', fontSize: '14pt' }}>
            {t('testClosure.pdfRemainingBugs', { count: bugs.filter((b) => b.desc.trim()).length })}
          </h3>
          {bugs.filter((b) => b.desc.trim()).length === 0 ? (
            <p style={{ fontSize: '10pt', color: '#6B7280' }}>{t('testClosure.pdfNoBugs')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6' }}>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfSeverity')}</th>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfDescription')}</th>
                </tr>
              </thead>
              <tbody>
                {bugs
                  .filter((b) => b.desc.trim())
                  .map((b) => (
                    <tr key={b.id}>
                      <td
                        style={{
                          padding: '8px',
                          border: '1px solid #E5E7EB',
                          color: b.severity === 'Critique' ? '#EF4444' : '#F59E0B',
                          fontWeight: 'bold',
                        }}
                      >
                        {t(`testClosure.${b.severity === 'Critique' ? 'critical' : 'major'}`)}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>{b.desc}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: '40px' }}>
          <h3 style={{ fontSize: '12pt', color: '#111827', marginBottom: '10px' }}>{t('testClosure.pdfSignOff')}</h3>
          <div
            style={{
              padding: '15px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              minHeight: '80px',
              fontSize: '10pt',
              whiteSpace: 'pre-wrap',
            }}
          >
            {signOffs || t('testClosure.pdfNotProvided')}
          </div>
        </div>
      </div>

      {/* FORMAT 2: DETAILED REPORT */}
      <div ref={pdfRefDetails} style={{ ...commonPDFStyle, display: 'none' }}>
        <div
          style={{
            borderBottom: '3px solid #111827',
            paddingBottom: '10px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '24pt', color: '#111827' }}>{t('testClosure.pdfDetailedTitle')}</h1>
            <h2 style={{ margin: 0, fontSize: '14pt', color: '#4B5563', fontWeight: 'normal' }}>
              {t('testClosure.pdfProjectLabel')} {project?.name} | {t('testClosure.pdfVersionLabel')} {version}
            </h2>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10pt', color: '#6B7280' }}>
            {t('testClosure.pdfPeriod', { startDate, endDate })}
          </div>
        </div>

        {/* Détail des sessions/runs */}
        <h3
          style={{
            fontSize: '14pt',
            borderBottom: '1px solid #E5E7EB',
            paddingBottom: '5px',
            marginTop: '20px',
            marginBottom: '15px',
          }}
        >
          {t('testClosure.pdfCampaignInventory')}
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#F3F4F6' }}>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfCampaignName')}</th>
              <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfType')}</th>
              <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfProgress')}</th>
              <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfSuccess')}</th>
            </tr>
          </thead>
          <tbody>
            {(m.runs || []).map((r) => (
              <tr key={r.id}>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>{r.name}</td>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                  {r.isExploratory ? t('testClosure.pdfExploratory') : t('testClosure.pdfScripted')}
                </td>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                  {r.completionRate}%
                </td>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #E5E7EB',
                    textAlign: 'center',
                    color: r.passRate >= 90 ? '#10B981' : '#EF4444',
                  }}
                >
                  {r.passRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Reprise de la grille des Bugs du rapport 1 */}
        <div style={{ marginTop: '30px', pageBreakInside: 'avoid' }}>
          <h3 style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '5px', fontSize: '14pt' }}>
            {t('testClosure.pdfRemainingBugs', { count: bugs.filter((b) => b.desc.trim()).length })}
          </h3>
          {bugs.filter((b) => b.desc.trim()).length === 0 ? (
            <p style={{ fontSize: '10pt', color: '#6B7280' }}>{t('testClosure.pdfNoBugs')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6' }}>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfSeverity')}</th>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>{t('testClosure.pdfDescription')}</th>
                </tr>
              </thead>
              <tbody>
                {bugs
                  .filter((b) => b.desc.trim())
                  .map((b) => (
                    <tr key={b.id}>
                      <td
                        style={{
                          padding: '8px',
                          border: '1px solid #E5E7EB',
                          color: b.severity === 'Critique' ? '#EF4444' : '#F59E0B',
                          fontWeight: 'bold',
                        }}
                      >
                        {t(`testClosure.${b.severity === 'Critique' ? 'critical' : 'major'}`)}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>{b.desc}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div
          style={{
            marginTop: '30px',
            backgroundColor: isGo ? '#ECFDF5' : isGoReserve ? '#FFFBEB' : '#FEF2F2',
            padding: '15px',
            borderRadius: '8px',
            borderLeft: `6px solid ${decisionColor}`,
            pageBreakInside: 'avoid',
          }}
        >
          <h2 style={{ margin: '0 0 10px 0', fontSize: '14pt', color: decisionColor }}>
            {t('testClosure.pdfRecommendation', { decision: decision.replace('_', ' ') })}
          </h2>
          <p style={{ margin: '0', fontSize: '9pt', whiteSpace: 'pre-wrap' }}>
            {residualRisks || t('testClosure.pdfNoResidualRisks')}
          </p>
        </div>

        <div style={{ marginTop: '30px' }}>
          <h3 style={{ fontSize: '12pt', color: '#111827', marginBottom: '10px' }}>{t('testClosure.pdfApprovals')}</h3>
          <div
            style={{
              padding: '15px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              minHeight: '60px',
              fontSize: '9pt',
              whiteSpace: 'pre-wrap',
            }}
          >
            {signOffs || t('testClosure.pdfNotProvided')}
          </div>
        </div>
      </div>
    </>
  );
};

export default TestClosureModal;
