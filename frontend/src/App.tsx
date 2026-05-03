/**
 * ================================================
 * TESTMO DASHBOARD - Main Application
 * ================================================
 * Point d'entrée React : orchestre le layout, le routing
 * et le cycle de vie des données via hooks dédiés.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 2.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { useCompactMode } from './hooks/useCompactMode';
import { usePreferences } from './hooks/usePreferences';
import { useDashboard } from './hooks/useDashboard';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import apiService from './services/api.service';
import { AlertCircle, RefreshCw } from 'lucide-react';
import AppLayout from './components/AppLayout';
import AppRouter from './components/AppRouter';
import FocusRestorer from './components/FocusRestorer';
import './styles/App.css';

function App() {
  const { t, i18n } = useTranslation();
  const { isDark, tvMode, toggleDark, toggleTv } = useTheme();
  const { compactMode, toggleCompactMode } = useCompactMode();
  const { user, isAuthenticated, isAdmin, loginWithGitLab, logout } = useAuth();
  const { showToast } = useToast();
  const { useBusinessTerms, setUseBusinessTerms, autoRefresh, setAutoRefresh } = usePreferences();
  const {
    projectId,
    setProjectId,
    projects,
    metrics,
    loading,
    error,
    backendStatus,
    exportHandler,
    setExportHandler,
    lastUpdate,
    selectedPreprodMilestones,
    setSelectedPreprodMilestones,
    selectedProdMilestones,
    setSelectedProdMilestones,
    showProductionSection,
    setShowProductionSection,
    liveConnected,
    liveError,
    circuitBreakers,
    checkBackendHealth,
    loadProjects,
    loadDashboardMetrics,
    handleClearCache,
  } = useDashboard();

  const navigate = useNavigate();
  const location = useLocation();

  const currentProject = useMemo(
    () => (Array.isArray(projects) ? projects.find((p) => p.id === projectId) : undefined),
    [projects, projectId]
  );

  const handleSaveSelection = useCallback(
    (preprodMilestones, prodMilestones) => {
      setSelectedPreprodMilestones(preprodMilestones || []);
      setSelectedProdMilestones(prodMilestones || []);
      navigate('/');
    },
    [navigate, setSelectedPreprodMilestones, setSelectedProdMilestones]
  );

  useAutoRefresh({
    checkBackendHealth,
    loadProjects,
  });

  const handleProjectChange = (event) => setProjectId(parseInt(event.target.value));
  const handleDashboardChange = (event) => navigate(event.target.value);

  const handleExportPdfBackend = async () => {
    if (!projectId) return;
    try {
      const blob = await apiService.generateBackendPDF(
        projectId,
        { preprod: selectedPreprodMilestones, prod: selectedProdMilestones },
        'A4',
        isDark,
        i18n.language
      );
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qa-dashboard-${projectId}-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast(t('app.toast.pdfSuccess'), 'success');
    } catch (err) {
      showToast(t('app.toast.pdfError'), 'error');
    }
  };

  const handleExportCSV = async () => {
    if (!projectId) return;
    try {
      const blob = await apiService.generateCSV(projectId, {
        preprod: selectedPreprodMilestones,
        prod: selectedProdMilestones,
      }, i18n.language);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qa-dashboard-${projectId}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast(t('app.toast.csvSuccess'), 'success');
    } catch (err) {
      showToast(t('app.toast.csvError'), 'error');
    }
  };

  const handleExportExcel = async () => {
    if (!projectId) return;
    try {
      const blob = await apiService.generateExcel(projectId, {
        preprod: selectedPreprodMilestones,
        prod: selectedProdMilestones,
      }, i18n.language);
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qa-dashboard-${projectId}-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast(t('app.toast.excelSuccess'), 'success');
    } catch (err) {
      showToast(t('app.toast.excelError'), 'error');
    }
  };

  if (error && !metrics) {
    return (
      <div className="app-error">
        <AlertCircle size={48} color="#EF4444" />
        <h2>{t('app.loadError.title')}</h2>
        <p>{error}</p>
        <button onClick={() => loadDashboardMetrics()} className="btn-retry" type="button">
          <RefreshCw size={16} />
          {t('app.loadError.retry')}
        </button>
      </div>
    );
  }

  return (
    <>
      <FocusRestorer />
      <AppLayout
      darkMode={isDark}
      tvMode={tvMode}
      toggleDarkMode={toggleDark}
      toggleTvMode={toggleTv}
      useBusinessTerms={useBusinessTerms}
      setUseBusinessTerms={setUseBusinessTerms}
      autoRefresh={autoRefresh}
      setAutoRefresh={setAutoRefresh}
      projectId={projectId}
      projects={projects}
      onProjectChange={handleProjectChange}
      onDashboardChange={handleDashboardChange}
      onRefresh={() => loadDashboardMetrics()}
      onClearCache={handleClearCache}
      loading={loading}
      backendStatus={backendStatus}
      lastUpdate={lastUpdate}
      liveConnected={liveConnected}
      liveError={liveError}
      circuitBreakers={circuitBreakers}
      compactMode={compactMode}
      toggleCompactMode={toggleCompactMode}
      currentPath={location.pathname}
      exportHandler={exportHandler}
      user={user}
      isAuthenticated={isAuthenticated}
      isAdmin={isAdmin}
      onLogin={loginWithGitLab}
      onLogout={logout}
      onExportPdfBackend={handleExportPdfBackend}
      onExportCSV={handleExportCSV}
      onExportExcel={handleExportExcel}
    >
      {loading && !metrics ? (
        <div className="loading-container">
          <RefreshCw size={48} className="spinner" />
          <p>{t('app.loadingMetrics')}</p>
        </div>
      ) : (
        <AppRouter
          metrics={metrics}
          currentProject={currentProject}
          projects={projects}
          projectId={projectId}
          onProjectChange={setProjectId}
          darkMode={isDark}
          useBusinessTerms={useBusinessTerms}
          setExportHandler={setExportHandler}
          showProductionSection={showProductionSection}
          onToggleProductionSection={setShowProductionSection}
          selectedPreprodMilestones={selectedPreprodMilestones}
          selectedProdMilestones={selectedProdMilestones}
          onSaveSelection={handleSaveSelection}
        />
      )}
    </AppLayout>
    </>
  );
}

export default App;
