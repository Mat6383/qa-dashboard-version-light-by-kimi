import React, { useRef, useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, CheckSquare, LineChart, GitCompare, Globe, TrendingUp, Settings, Monitor } from 'lucide-react';
import TestClosureModal from './TestClosureModal';
import { useExportPDF } from '../hooks/useExportPDF';
import QuickClosureModal from './QuickClosureModal';
import ReportGeneratorModal from './ReportGeneratorModal';
import PreprodSection from './PreprodSection';
import ProductionSection from './ProductionSection';
import HistoricalTrends from './HistoricalTrends';
import CompareDashboard from './CompareDashboard';
import Dashboard5 from './Dashboard5';
import Dashboard6 from './Dashboard6';
import SkeletonDashboard from './SkeletonDashboard';
import MilestoneChips from './MilestoneChips';
import TVModeOverlay from './TVModeOverlay';
import ReleaseReadinessScore from './ReleaseReadinessScore';
import SmartAlerts from './SmartAlerts';
import ActivityFeed from './ActivityFeed';
import { useTemporalComparison } from '../hooks/useTemporalComparison';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { useProjectMilestones } from '../hooks/queries';
import { useDashboard } from '../hooks/useDashboard';
import '../styles/Dashboard4.css';
import '../styles/KPICard.css';
import '../styles/Tabs.css';
import '../styles/ProSuite.css';

const DEFAULT_RATES = {
  escapeRate: 0,
  detectionRate: 0,
  bugsInProd: 0,
  bugsInTest: 0,
  totalBugs: 0,
  preprodMilestone: '—',
  prodMilestone: '—',
  message: 'Indisponible',
};

const tabs = [
  { id: 'overview', labelKey: 'dashboard4.overview', icon: Globe },
  { id: 'historical', labelKey: 'dashboard4.historical', icon: LineChart },
  { id: 'compare', labelKey: 'dashboard4.compare', icon: GitCompare },
  { id: 'annual-trends', labelKey: 'dashboard4.annualTrends', icon: TrendingUp },
  { id: 'gitlab-sync', labelKey: 'dashboard4.gitlabSync', icon: Settings },
];

interface Dashboard4Props {
  metrics?: any;
  project?: any;
  projects?: any[];
  projectId?: number | null;
  onProjectChange?: (id: number | string) => void;
  isDark?: boolean;
  useBusiness?: boolean;
  setExportHandler?: (handler: () => void) => void;
  showProductionSection?: boolean;
  onToggleProductionSection?: () => void;
  anomalies?: any[];
  selectedPreprodMilestones?: number[];
  selectedProdMilestones?: number[];
  onTogglePreprodMilestone?: (id: number) => void;
  onToggleProdMilestone?: (id: number) => void;
}

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
  selectedPreprodMilestones = [],
  selectedProdMilestones = [],
  onTogglePreprodMilestone,
  onToggleProdMilestone,
}: Dashboard4Props) => {
  const { t } = useTranslation();
  const dashboardRef = useRef(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAllRuns, setShowAllRuns] = React.useState(false);
  const [showLatestOnly, setShowLatestOnly] = React.useState(false);
  const [showExploratoryByMilestone, setShowExploratoryByMilestone] = React.useState(false);
  const [showClosureModal, setShowClosureModal] = React.useState(false);
  const [showQuickClosureModal, setShowQuickClosureModal] = React.useState(false);
  const [showReportGenerator, setShowReportGenerator] = React.useState(false);
  const [showTVMode, setShowTVMode] = React.useState(false);
  const [dismissedAlerts, setDismissedAlerts] = React.useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_alerts') || '[]');
    } catch {
      return [];
    }
  });

  const handleDismissAlert = React.useCallback((id: string) => {
    setDismissedAlerts((prev) => {
      const next = [...prev, id];
      localStorage.setItem('dismissed_alerts', JSON.stringify(next));
      return next;
    });
  }, []);

  const { exportPDF, exportElement } = useExportPDF({
    orientation: 'landscape',
    backgroundColor: 'var(--bg-color)',
  });

  // Option C — Temporal comparison
  const { getTemporalForMetric, isLoading: temporalLoading } = useTemporalComparison(
    projectId,
    activeTab === 'overview'
  );

  // Option C — Dashboard layout (drag & drop)
  const { layout, moveWidget, resetLayout } = useDashboardLayout();

  // Option C — Milestones for inline chips
  const { data: availableMilestones = [] } = useProjectMilestones(projectId);
  const { lastLiveEventAt } = useDashboard();

  const runs = useMemo(() => metrics?.runs || [], [metrics?.runs]);
  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => (a.isExploratory ? 1 : 0) - (b.isExploratory ? 1 : 0)),
    [runs]
  );
  const latestRun = useMemo(() => runs.find((r) => !r.isExploratory) || runs[0], [runs]);

  const displayedRuns = useMemo(() => {
    let base = showLatestOnly && latestRun ? [latestRun] : sortedRuns;
    if (showExploratoryByMilestone) {
      // Déterminer les milestones cibles : explicites ou déduites des runs standards visibles
      const standardRuns = base.filter((r) => !r.isExploratory);
      const targetMilestones =
        selectedPreprodMilestones.length > 0
          ? selectedPreprodMilestones
          : Array.from(new Set(standardRuns.map((r) => r.milestone).filter(Boolean)));
      // Retirer les exploratoires de la base ; seuls ceux liés aux milestones cibles seront réinjectés
      base = base.filter((r) => !r.isExploratory);
      const exploratory = sortedRuns.filter(
        (r) =>
          r.isExploratory &&
          targetMilestones.includes(r.milestone as number) &&
          !base.some((br) => br.id === r.id)
      );
      base = [...base, ...exploratory];
    } else {
      // Toggle OFF : masquer les exploratoires
      base = base.filter((r) => !r.isExploratory);
    }
    return base;
  }, [
    showLatestOnly,
    latestRun,
    sortedRuns,
    showExploratoryByMilestone,
    selectedPreprodMilestones,
  ]);
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
    const safeName = (project.name || 'project').replace(/[^a-zA-Z0-9\-_]/g, '_');
    await exportPDF(dashboardRef.current, `QA_Dashboard_${safeName}_${new Date().toLocaleDateString('fr-FR')}.pdf`);
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

  // Option C — Per-card export
  const handleExportCard = useCallback(
    async (element: HTMLElement, title: string) => {
      if (!element) return;
      const safeName = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      await exportElement(element, `KPI_${safeName}_${new Date().toLocaleDateString('fr-FR')}.png`, {
        format: 'png',
        scale: 2,
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
      });
    },
    [exportElement, isDark]
  );

  const handleExportDoughnut = useCallback(
    async (element: HTMLElement) => {
      if (!element) return;
      await exportElement(element, `Repartition_${project?.name || 'Dashboard'}_${new Date().toLocaleDateString('fr-FR')}.png`, {
        format: 'png',
        scale: 2,
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
      });
    },
    [exportElement, project, isDark]
  );

  const d1 = metrics;
  const raw = d1?.raw || { completed: 0, total: 0, passed: 0, failed: 0, wip: 0, blocked: 0, untested: 0 };

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

      <div className="tabs-list" role="tablist" aria-label={t('dashboard4.title')} style={{ marginBottom: 'var(--spacing-md)' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`d4-tabpanel-${tab.id}`}
              id={`d4-tab-${tab.id}`}
              className={`tab-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <Icon size={16} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div ref={dashboardRef} role="tabpanel" id="d4-tabpanel-overview" aria-labelledby="d4-tab-overview">
          {!metrics || !project ? (
            <SkeletonDashboard />
          ) : (
            <div className={`tv-dashboard dashboard4-card ${isDark ? 'tv-dark-theme' : ''}`}>
              <header className="dashboard4-hidden-header">{/* Ancien header masqué */}</header>

              {/* Option C — Inline milestone chips */}
              <div className="dashboard4-chips-row">
                <MilestoneChips
                  milestones={availableMilestones}
                  selected={selectedPreprodMilestones}
                  onToggle={onTogglePreprodMilestone || (() => {})}
                  variant="preprod"
                  label={useBusiness ? 'Préprod' : 'Preprod'}
                />
                <MilestoneChips
                  milestones={availableMilestones}
                  selected={selectedProdMilestones}
                  onToggle={onToggleProdMilestone || (() => {})}
                  variant="prod"
                  label={useBusiness ? 'Prod' : 'Prod'}
                />
              </div>

              {(project || latestRun) && (
                <div className={`dashboard4-banner ${isDark ? 'dashboard4-banner--dark' : ''}`}>
                  <div className="dashboard4-banner-left">
                    <span className="dashboard4-project-name">{project?.name}</span>
                    {latestRun ? (
                      <>
                        <span className="dashboard4-separator">—</span>
                        <span className="dashboard4-run-name">{latestRun.name}</span>
                        <span className="dashboard4-badge">{t('dashboard4.inProgress')}</span>
                      </>
                    ) : (
                      <span className="dashboard4-badge" style={{ marginLeft: '0.5rem', backgroundColor: 'var(--text-muted)' }}>
                        {t('dashboard4.noActiveRun', { defaultValue: 'Aucun run actif pour les cycles sélectionnés' })}
                      </span>
                    )}
                  </div>
                  <ReleaseReadinessScore
                    projectId={projectId}
                    preprodMilestones={selectedPreprodMilestones}
                    prodMilestones={selectedProdMilestones}
                    isDark={isDark}
                  />
                </div>
              )}

              <SmartAlerts
                metrics={metrics}
                anomalies={anomalies}
                onDismiss={handleDismissAlert}
                dismissed={dismissedAlerts}
              />

              <ActivityFeed anomalies={anomalies} lastLiveEventAt={lastLiveEventAt} />

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
                <button
                  className="btn-action btn-action-secondary"
                  onClick={() => setShowTVMode(true)}
                  type="button"
                  title="Mode TV"
                >
                  <Monitor size={16} /> Mode TV
                </button>
              </div>

              <PreprodSection
                metrics={metrics}
                raw={raw}
                sortedRuns={displayedRuns}
                originalRunsCount={sortedRuns.length}
                showAllRuns={showAllRuns}
                setShowAllRuns={setShowAllRuns}
                showLatestOnly={showLatestOnly}
                setShowLatestOnly={setShowLatestOnly}
                showExploratoryByMilestone={showExploratoryByMilestone}
                setShowExploratoryByMilestone={setShowExploratoryByMilestone}
                isDark={isDark}
                useBusiness={useBusiness}
                getAlertForMetric={getAlertForMetric}
                anomalies={anomalies}
                layout={layout.preprod}
                onMoveWidget={moveWidget}
                dragEnabled={true}
                getTemporalForMetric={getTemporalForMetric}
                onExportCard={handleExportCard}
                onExportDoughnut={handleExportDoughnut}
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
                layout={layout.production}
                onMoveWidget={moveWidget}
                dragEnabled={true}
                getTemporalForMetric={getTemporalForMetric}
                onExportCard={handleExportCard}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'historical' && (
        <div role="tabpanel" id="d4-tabpanel-historical" aria-labelledby="d4-tab-historical">
          <HistoricalTrends projectId={projectId} isDark={isDark} />
        </div>
      )}

      {activeTab === 'compare' && (
        <div role="tabpanel" id="d4-tabpanel-compare" aria-labelledby="d4-tab-compare">
          <CompareDashboard isDark={isDark} />
        </div>
      )}

      {activeTab === 'annual-trends' && (
        <div role="tabpanel" id="d4-tabpanel-annual-trends" aria-labelledby="d4-tab-annual-trends">
          <Dashboard5 projectId={projectId} isDark={isDark} useBusiness={useBusiness} />
        </div>
      )}

      {activeTab === 'gitlab-sync' && (
        <div role="tabpanel" id="d4-tabpanel-gitlab-sync" aria-labelledby="d4-tab-gitlab-sync">
          <Dashboard6 isDark={isDark} />
        </div>
      )}

      {metrics && project && (
        <>
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
        </>
      )}

      {/* Option C — TV Mode Overlay */}
      <TVModeOverlay
        isOpen={showTVMode}
        onClose={() => setShowTVMode(false)}
        metrics={metrics}
        raw={raw}
        rates={rates}
        anomalies={anomalies}
        useBusiness={useBusiness}
        projectName={project?.name}
      />
    </div>
  );
};

export default Dashboard4;
