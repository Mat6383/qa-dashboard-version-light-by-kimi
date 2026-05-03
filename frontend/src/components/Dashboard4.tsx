import React, { useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CheckSquare } from 'lucide-react';
import TestClosureModal from './TestClosureModal';
import { useExportPDF } from '../hooks/useExportPDF';
import QuickClosureModal from './QuickClosureModal';
import ReportGeneratorModal from './ReportGeneratorModal';
import PreprodSection from './PreprodSection';
import ProductionSection from './ProductionSection';
import '../styles/Dashboard4.css';

const DEFAULT_RATES = {
  escapeRate: 0,
  detectionRate: 0,
  bugsInProd: 0,
  bugsInTest: 0,
  totalBugs: 0,
  preprodMilestone: 'N/A',
  prodMilestone: 'N/A',
  message: 'Indisponible',
};

const Dashboard4 = ({
  metrics,
  project,
  projects = [],
  projectId,
  onProjectChange,
  isDark = false,
  useBusiness = true,
  setExportHandler,
  showProductionSection = true,
  onToggleProductionSection,
  anomalies = [],
}) => {
  const { t } = useTranslation();
  const dashboardRef = useRef(null);
  const [showAllRuns, setShowAllRuns] = React.useState(false);
  const [showClosureModal, setShowClosureModal] = React.useState(false);
  const [showQuickClosureModal, setShowQuickClosureModal] = React.useState(false);
  const [showReportGenerator, setShowReportGenerator] = React.useState(false);
  const { exportPDF } = useExportPDF({
    orientation: 'landscape',
    backgroundColor: 'var(--bg-color)',
  });

  const runs = useMemo(() => metrics?.runs || [], [metrics?.runs]);
  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => (a.isExploratory ? 1 : 0) - (b.isExploratory ? 1 : 0)),
    [runs]
  );
  const latestRun = useMemo(() => runs.find((r) => !r.isExploratory) || runs[0], [runs]);
  const rates = metrics?.qualityRates || DEFAULT_RATES;

  const escapeOk = rates.escapeRate < 5;
  const ddpOk = rates.detectionRate > 95;

  const getAlertForMetric = useCallback(
    (metricName) => {
      if (!metrics?.slaStatus || metrics.slaStatus.ok || !metrics.slaStatus.alerts) return null;
      return metrics.slaStatus.alerts.find((a) => a.metric === metricName);
    },
    [metrics?.slaStatus]
  );

  const handleExportPDF = useCallback(async () => {
    if (!dashboardRef.current || !project) return;
    await exportPDF(dashboardRef.current, `QA_Dashboard_${project.name}_${new Date().toLocaleDateString('fr-FR')}.pdf`);
  }, [exportPDF, project]);

  const handleExportPDFRef = useRef(handleExportPDF);
  handleExportPDFRef.current = handleExportPDF;

  React.useEffect(() => {
    if (setExportHandler) {
      setExportHandler(() => handleExportPDFRef.current);
    }
    return () => {
      if (setExportHandler) setExportHandler(null);
    };
  }, [setExportHandler]);

  if (!metrics || !project) {
    return (
      <div className="tv-loading">
        <Activity size={48} className="spinner" />
        <h2>{t('dashboard4.loading')}</h2>
      </div>
    );
  }

  const d1 = metrics;
  const raw = d1.raw || { completed: 0, total: 0, passed: 0, failed: 0, wip: 0, blocked: 0, untested: 0 };

  return (
    <div className="dashboard4-root">
      {projects.length > 0 && onProjectChange && (
        <div className="dashboard4-project-row">
          <span className="dashboard4-label">{t('dashboard4.project')}</span>
          <select
            value={projectId}
            onChange={(e) => onProjectChange(parseInt(e.target.value))}
            className="project-selector"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        ref={dashboardRef}
        className={`tv-dashboard dashboard4-card ${isDark ? 'tv-dark-theme' : ''}`}
      >
        <header className="dashboard4-hidden-header">{/* Ancien header masqué */}</header>
        {(project || latestRun) && (
          <div className={`dashboard4-banner ${isDark ? 'dashboard4-banner--dark' : ''}`}>
            <span className="dashboard4-project-name">{project?.name}</span>
            {latestRun && (
              <>
                <span className="dashboard4-separator">—</span>
                <span className="dashboard4-run-name">
                  {latestRun.name}
                </span>
                <span className="dashboard4-badge">
                  {t('dashboard4.inProgress')}
                </span>
              </>
            )}
          </div>
        )}

        {/* Boutons d'action */}
        <div className="dashboard4-actions">
          <button className="btn-action btn-action-primary" onClick={() => setShowClosureModal(true)}>
            <CheckSquare size={16} /> {t('dashboard4.testClosure')}
          </button>
          <button className="btn-action btn-action-success" onClick={() => setShowQuickClosureModal(true)}>
            <CheckSquare size={16} /> {t('dashboard4.quickClosure')}
          </button>
          <button className="btn-action btn-action-secondary" onClick={() => setShowReportGenerator(true)}>
            <CheckSquare size={16} /> {t('dashboard4.reportGenerator')}
          </button>
        </div>

        <PreprodSection
          metrics={metrics}
          raw={raw}
          sortedRuns={sortedRuns}
          showAllRuns={showAllRuns}
          setShowAllRuns={setShowAllRuns}
          isDark={isDark}
          useBusiness={useBusiness}
          getAlertForMetric={getAlertForMetric}
          anomalies={anomalies}
        />

        <ProductionSection
          rates={rates}
          escapeOk={escapeOk}
          ddpOk={ddpOk}
          showProductionSection={showProductionSection}
          onToggleProductionSection={onToggleProductionSection}
          isDark={isDark}
          useBusiness={useBusiness}
          anomalies={anomalies}
        />
      </div>

      <TestClosureModal
        isOpen={showClosureModal}
        onClose={() => setShowClosureModal(false)}
        metrics={metrics}
        project={project}
        useBusiness={useBusiness}
        isDark={isDark}
      />

      <QuickClosureModal
        isOpen={showQuickClosureModal}
        onClose={() => setShowQuickClosureModal(false)}
        metrics={metrics}
        project={project}
        useBusiness={useBusiness}
        isDark={isDark}
      />

      <ReportGeneratorModal
        isOpen={showReportGenerator}
        onClose={() => setShowReportGenerator(false)}
        metrics={metrics}
        project={project}
        isDark={isDark}
      />
    </div>
  );
};

export default Dashboard4;
