import React, { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import ToolsPage from './ToolsPage';

// Lazy loading des routes secondaires
const AuthCallback = lazy(() => import('./AuthCallback'));
const NotificationSettings = lazy(() => import('./NotificationSettings'));
const HistoricalTrends = lazy(() => import('./HistoricalTrends'));
const CompareDashboard = lazy(() => import('./CompareDashboard'));
const AuditLogViewer = lazy(() => import('./AuditLogViewer'));

// Lazy loading des dashboards administratifs et secondaires
const GlobalViewDashboard = lazy(() => import('./GlobalViewDashboard'));
const MultiProjectDashboard = lazy(() => import('./MultiProjectDashboard'));
const FeatureFlagsAdmin = lazy(() => import('./FeatureFlagsAdmin'));
const AnalyticsPanel = lazy(() => import('./AnalyticsPanel'));
const RetentionAdmin = lazy(() => import('./RetentionAdmin'));
const IntegrationsAdmin = lazy(() => import('./IntegrationsAdmin'));

function LoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="loading-container">
      <div className="spinner" />
      <p>{t('appRouter.loadingDashboard')}</p>
    </div>
  );
}

export default function AppRouter({
  metrics,
  currentProject,
  projects,
  projectId,
  onProjectChange,
  darkMode,
  useBusinessTerms,
  setExportHandler,
  showProductionSection,
  onToggleProductionSection,
  selectedPreprodMilestones,
  selectedProdMilestones,
  onSaveSelection,
  onTogglePreprodMilestone,
  onToggleProdMilestone,
}) {
  const { anomalies } = useDashboard();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route
          path="/global-view"
          element={
            <GlobalViewDashboard
              metrics={metrics}
              project={currentProject}
              projects={projects}
              projectId={projectId}
              onProjectChange={onProjectChange}
              isDark={darkMode}
              useBusiness={useBusinessTerms}
              setExportHandler={setExportHandler}
              showProductionSection={showProductionSection}
              onToggleProductionSection={onToggleProductionSection}
              anomalies={anomalies}
              selectedPreprodMilestones={selectedPreprodMilestones}
              selectedProdMilestones={selectedProdMilestones}
              onTogglePreprodMilestone={onTogglePreprodMilestone}
              onToggleProdMilestone={onToggleProdMilestone}
            />
          }
        />
        <Route
          path="/tools"
          element={
            <ToolsPage
              isDark={darkMode}
              projectId={projectId}
              initialPreprodMilestones={selectedPreprodMilestones}
              initialProdMilestones={selectedProdMilestones}
              onSaveSelection={onSaveSelection}
            />
          }
        />
        <Route path="/multi-project" element={<MultiProjectDashboard isDark={darkMode} />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/notifications" element={<NotificationSettings isDark={darkMode} />} />
        <Route path="/historical-trends" element={<HistoricalTrends projectId={projectId} isDark={darkMode} />} />
        <Route path="/compare" element={<CompareDashboard isDark={darkMode} />} />
        <Route path="/admin/audit" element={<AuditLogViewer isDark={darkMode} />} />
        <Route path="/admin/feature-flags" element={<FeatureFlagsAdmin isDark={darkMode} />} />
        <Route path="/admin/analytics" element={<AnalyticsPanel projectId={projectId} isDark={darkMode} />} />
        <Route path="/admin/retention" element={<RetentionAdmin isDark={darkMode} />} />
        <Route path="/admin/integrations" element={<IntegrationsAdmin isDark={darkMode} />} />
        <Route path="/" element={<Navigate to="/global-view" replace />} />
      </Routes>
    </Suspense>
  );
}
