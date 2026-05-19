import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Menu } from 'lucide-react';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { useIsMobile } from '../hooks/useMediaQuery';
import MobileDrawer from './MobileDrawer';
import MobileBottomNav from './MobileBottomNav';
import ShortcutHelpOverlay from './ShortcutHelpOverlay';
import Breadcrumb from './Breadcrumb';
import ExportFAB from './ExportFAB';
import TopBar from './layout/TopBar';
import MobileDrawerContent from './layout/MobileDrawerContent';

function formatLiveAgo(date: Date, lang: string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return lang === 'fr' ? 'à l\'instant' : 'just now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function getDashboardRoutes(isAdmin, t) {
  const routes = [
    { path: '/global-view', label: t('dashboard.globalView') },
    { path: '/multi-project', label: t('dashboard.multiProject') },
    { path: '/tools', label: t('dashboard.tools') },
  ];
  if (isAdmin) {
    routes.push({ path: '/notifications', label: t('dashboard.notifications') });
    routes.push({ path: '/admin/audit', label: t('dashboard.auditLogs') });
    routes.push({ path: '/admin/feature-flags', label: t('dashboard.featureFlags') });
    routes.push({ path: '/admin/analytics', label: t('dashboard.analytics') });
    routes.push({ path: '/admin/retention', label: t('dashboard.retention') });
    routes.push({ path: '/admin/integrations', label: t('dashboard.integrations') });
  }
  return routes;
}

export default function AppLayout({
  children,
  darkMode,
  tvMode,
  toggleDarkMode,
  toggleTvMode,
  useBusinessTerms,
  setUseBusinessTerms,
  autoRefresh,
  setAutoRefresh,
  projectId,
  projects,
  onProjectChange,
  onDashboardChange,
  onRefresh,
  onClearCache,
  loading,
  backendStatus,
  lastUpdate,
  currentPath,
  exportHandler,
  user,
  isAuthenticated,
  isAdmin,
  onLogin,
  onDevLogin,
  onLogout,
  onExportPdfBackend,
  onExportCSV,
  onExportExcel,
  liveConnected,
  liveError,
  lastLiveEventAt,
  circuitBreakers,
  compactMode,
  toggleCompactMode,
}) {
  const { t, i18n } = useTranslation();
  const dashboardRoutes = getDashboardRoutes(isAdmin, t);
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);

  useGlobalShortcuts({ onHelp: () => setShowHelp((prev) => !prev) });

  return (
    <div className={`app ${tvMode ? 'tv-mode' : ''} ${darkMode ? 'dark-theme' : ''}`}>
      {/* Skip Link */}
      <a href="#main-content" className="skip-link">
        {t('layout.skipToContent')}
      </a>

      {/* Banner mode dégradé */}
      {circuitBreakers?.some((b) => b.state === 'OPEN') && (
        <div
          style={{
            backgroundColor: 'var(--action-warning-surface)',
            color: 'var(--action-warning-text)',
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderBottom: '1px solid var(--action-warning-border)',
          }}
          role="alert"
        >
          <AlertTriangle size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
          {t('layout.degradedMode')} (
          {circuitBreakers
            .filter((b) => b.state === 'OPEN')
            .map((b) => b.name)
            .join(', ')}
          )
        </div>
      )}

      {/* Header */}
      {isMobile ? (
        <header className="app-header" role="banner">
          <div className="header-left">
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{t('layout.title')}</span>
          </div>
          <div className="header-right">
            {projects.length > 0 && (
              <select
                value={projectId}
                onChange={onProjectChange}
                className="project-selector"
                aria-label={t('layout.selectProject')}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn-icon"
              onClick={() => setDrawerOpen(true)}
              aria-label={t('layout.openMenu')}
              type="button"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <Menu size={20} />
            </button>
          </div>
        </header>
      ) : (
        <TopBar
          projects={projects}
          projectId={projectId}
          onProjectChange={onProjectChange}
          tvMode={tvMode}
          toggleTvMode={toggleTvMode}
          compactMode={compactMode}
          toggleCompactMode={toggleCompactMode}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          currentPath={currentPath}
          onDashboardChange={onDashboardChange}
          dashboardRoutes={dashboardRoutes}
          exportHandler={exportHandler}
          onExportPdfBackend={onExportPdfBackend}
          onExportCSV={onExportCSV}
          onExportExcel={onExportExcel}
          useBusinessTerms={useBusinessTerms}
          setUseBusinessTerms={setUseBusinessTerms}
          liveConnected={liveConnected}
          liveError={liveError}
          lastLiveEventAt={lastLiveEventAt}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          onRefresh={onRefresh}
          loading={loading}
          onClearCache={onClearCache}
          user={user}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          onLogin={onLogin}
          onDevLogin={onDevLogin}
          onLogout={onLogout}
          backendStatus={backendStatus}
        />
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={t('layout.settings')}
        >
          <MobileDrawerContent
            projects={projects}
            projectId={projectId}
            onProjectChange={onProjectChange}
            tvMode={tvMode}
            toggleTvMode={toggleTvMode}
            compactMode={compactMode}
            toggleCompactMode={toggleCompactMode}
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            currentPath={currentPath}
            onDashboardChange={onDashboardChange}
            dashboardRoutes={dashboardRoutes}
            exportHandler={exportHandler}
            onExportPdfBackend={onExportPdfBackend}
            onExportCSV={onExportCSV}
            onExportExcel={onExportExcel}
            useBusinessTerms={useBusinessTerms}
            setUseBusinessTerms={setUseBusinessTerms}
            autoRefresh={autoRefresh}
            setAutoRefresh={setAutoRefresh}
            onRefresh={onRefresh}
            loading={loading}
            onClearCache={onClearCache}
            user={user}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            onLogin={onLogin}
            onLogout={onLogout}
            backendStatus={backendStatus}
          />
        </MobileDrawer>
      )}

      {/* Breadcrumb admin */}
      <Breadcrumb />

      {/* Main Content */}
      <main id="main-content" className="app-main" role="main" tabIndex={-1}>
        {children}
      </main>

      <ShortcutHelpOverlay isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {isMobile && <MobileBottomNav isAdmin={isAdmin} />}
      {isMobile && currentPath === '/global-view' && (
        <ExportFAB
          onExportPdf={exportHandler}
          onExportPdfBackend={onExportPdfBackend}
          onExportCSV={onExportCSV}
          onExportExcel={onExportExcel}
        />
      )}

      {/* Footer */}
      <footer className="app-footer" role="contentinfo">
        <div className="footer-content">
          <span>{t('layout.footer.copyright')}</span>
          {liveConnected && lastLiveEventAt ? (
            <span className="last-update live-footer">
              <span className="pulse-dot" /> LIVE — {formatLiveAgo(lastLiveEventAt, i18n.language)}
            </span>
          ) : lastUpdate && (
            <span className="last-update">{t('layout.footer.lastUpdate')}: {lastUpdate.toLocaleTimeString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')}</span>
          )}
          <span>{t('layout.footer.standards')}</span>
        </div>
      </footer>
    </div>
  );
}
