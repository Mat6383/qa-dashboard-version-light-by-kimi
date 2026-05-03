import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Database,
  Settings,
  Monitor,
  Download,
  LogIn,
  LogOut,
  User,
  FileText,
  FileSpreadsheet,
  Radio,
  Globe,
  LayoutTemplate,
  Menu,
  ChevronDown,
} from 'lucide-react';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { useIsMobile } from '../hooks/useMediaQuery';
import MobileDrawer from './MobileDrawer';
import MobileBottomNav from './MobileBottomNav';
import ShortcutHelpOverlay from './ShortcutHelpOverlay';
import Breadcrumb from './Breadcrumb';
import ExportFAB from './ExportFAB';

function getDashboardRoutes(isAdmin, t) {
  const routes = [
    { path: '/', label: t('dashboard.standard') },
    { path: '/tv', label: t('dashboard.tv') },
    { path: '/quality-rates', label: t('dashboard.qualityRates') },
    { path: '/global-view', label: t('dashboard.globalView') },
    { path: '/annual-trends', label: t('dashboard.annualTrends') },
    { path: '/multi-project', label: t('dashboard.multiProject') },
    { path: '/historical-trends', label: t('dashboard.historicalTrends') },
    { path: '/compare', label: t('dashboard.compare') },
    { path: '/sync-gitlab-to-testmo', label: t('dashboard.syncGitlabToTestmo') },
    { path: '/configuration', label: t('dashboard.configuration') },
    { path: '/crosstest', label: t('dashboard.crosstest') },
    { path: '/auto-sync', label: t('dashboard.autoSync') },
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

function BackendStatus({ status, t }) {
  const config = {
    checking: { Icon: Activity, color: 'var(--text-warning)', text: t('layout.backendStatus.checking') },
    ok: { Icon: CheckCircle2, color: 'var(--text-success)', text: t('layout.backendStatus.ok') },
    error: { Icon: AlertCircle, color: 'var(--text-danger)', text: t('layout.backendStatus.error') },
  };
  const { Icon, color, text } = config[status] || config.checking;

  return (
    <div className="backend-status" style={{ color }}>
      <Icon size={16} />
      <span>{text}</span>
    </div>
  );
}

export default function AppLayout({
  children,
  // Theme & prefs
  darkMode,
  tvMode,
  toggleDarkMode,
  toggleTvMode,
  useBusinessTerms,
  setUseBusinessTerms,
  autoRefresh,
  setAutoRefresh,
  // Data & actions
  projectId,
  projects,
  onProjectChange,
  onDashboardChange,
  onRefresh,
  onClearCache,
  loading,
  backendStatus,
  lastUpdate,
  // Routing
  currentPath,
  // Export
  exportHandler,
  // Auth
  user,
  isAuthenticated,
  isAdmin,
  onLogin,
  onLogout,
  onExportPdfBackend,
  onExportCSV,
  onExportExcel,
  // Live
  liveConnected,
  liveError,
  // Resilience
  circuitBreakers,
  // Compact mode
  compactMode,
  toggleCompactMode,
}) {
  const { t, i18n } = useTranslation();
  const dashboardRoutes = getDashboardRoutes(isAdmin, t);
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const [showHelp, setShowHelp] = React.useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportMenuOpen]);
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
      <header className="app-header" role="banner">
        <div className="header-left">
          <Database size={32} color="var(--text-primary)" />
          <div className="header-title">
            <h1>{t('layout.title')}</h1>
            {!isMobile && <p className="header-subtitle">{t('layout.subtitle')}</p>}
          </div>
        </div>

        {isMobile ? (
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
        ) : (
          <div className="header-right">
          {/* Sélecteur de projet */}
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

          {/* Toggle TV Mode */}
          <button
            className={`btn-toggle ${tvMode ? 'active' : ''}`}
            onClick={toggleTvMode}
            title={tvMode ? t('layout.tvModeOn') : t('layout.tvModeOff')}
            type="button"
          >
            <Monitor size={16} />
            <span className="header-toggle-label">
              {tvMode ? t('layout.tvModeOn') : t('layout.tvModeOff')}
            </span>
          </button>

          {/* Toggle Compact Mode */}
          <button
            className={`btn-toggle ${compactMode ? 'active' : ''}`}
            onClick={toggleCompactMode}
            title={compactMode ? t('layout.compactModeOn') : t('layout.compactModeOff')}
            type="button"
            data-testid="compact-mode-toggle"
          >
            <LayoutTemplate size={16} />
            <span className="header-toggle-label">
              {compactMode ? t('layout.compactModeOn') : t('layout.compactModeOff')}
            </span>
          </button>

          {/* Toggle Dark Theme */}
          <div
            className="switch-container"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-color)' }}>{t('layout.darkTheme')}</span>
            <label className="theme-switch" aria-label={t('layout.darkTheme')}>
              <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} aria-label={t('layout.darkTheme')} />
              <span className="slider round" />
            </label>
          </div>

          {/* Sélecteur de Dashboard */}
          <div>
            <select
              value={currentPath}
              onChange={onDashboardChange}
              className="project-selector"
              style={{
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
              }}
              aria-label={t('layout.selectDashboard')}
            >
              {dashboardRoutes.map((route) => (
                <option key={route.path} value={route.path}>
                  {route.label}
                </option>
              ))}
            </select>
          </div>

          {/* Export Dropdown */}
          {currentPath === '/global-view' && (exportHandler || onExportPdfBackend || onExportCSV || onExportExcel) && (
            <div className="export-dropdown" ref={exportMenuRef}>
              <button
                className="btn-icon"
                onClick={() => setExportMenuOpen((prev) => !prev)}
                title={t('layout.export')}
                type="button"
                aria-haspopup="true"
                aria-expanded={exportMenuOpen}
              >
                <Download size={16} />
                <ChevronDown size={14} />
              </button>
              {exportMenuOpen && (
                <div className="export-dropdown-menu" role="menu">
                  {exportHandler && (
                    <button className="export-dropdown-item" onClick={() => { exportHandler(); setExportMenuOpen(false); }} role="menuitem" type="button">
                      <Download size={14} /> {t('layout.exportPdf')}
                    </button>
                  )}
                  {onExportPdfBackend && (
                    <button className="export-dropdown-item" onClick={() => { onExportPdfBackend(); setExportMenuOpen(false); }} role="menuitem" type="button">
                      <Download size={14} /> {t('layout.exportPdfBackend')}
                    </button>
                  )}
                  {onExportCSV && (
                    <button className="export-dropdown-item" onClick={() => { onExportCSV(); setExportMenuOpen(false); }} role="menuitem" type="button">
                      <FileText size={14} /> {t('layout.exportCsv')}
                    </button>
                  )}
                  {onExportExcel && (
                    <button className="export-dropdown-item" onClick={() => { onExportExcel(); setExportMenuOpen(false); }} role="menuitem" type="button">
                      <FileSpreadsheet size={14} /> {t('layout.exportExcel')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Toggle Vocabulaire Métier */}
          <div
            className="switch-container"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-color)' }}>
              {t('layout.businessTerms')}
            </span>
            <label className="theme-switch" aria-label={t('layout.businessTerms')}>
              <input
                type="checkbox"
                checked={useBusinessTerms}
                onChange={() => setUseBusinessTerms(!useBusinessTerms)}
                aria-label={t('layout.businessTerms')}
              />
              <span className="slider round" />
            </label>
          </div>

          {/* Indicateur Live */}
          {liveConnected && (
            <div
              className="live-indicator"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginRight: '8px',
                color: 'var(--text-success)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
              title={t('layout.liveIndicator')}
            >
              <Radio size={14} className="live-pulse" />
              <span>LIVE</span>
            </div>
          )}
          {liveError && !liveConnected && (
            <div
              className="live-indicator"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginRight: '8px',
                color: 'var(--text-danger)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
              title={liveError || t('layout.offlineIndicator')}
            >
              <Radio size={14} />
              <span>OFFLINE</span>
            </div>
          )}

          {/* Sélecteur de langue */}
          <button
            className="btn-toggle"
            onClick={() => changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')}
            title={t('common.language')}
            type="button"
          >
            <Globe size={16} />
            {i18n.language === 'fr' ? 'FR' : 'EN'}
          </button>

          {/* Toggle auto-refresh */}
          <button
            className={`btn-toggle ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-refresh 1m"
            type="button"
          >
            <RefreshCw size={16} className={autoRefresh ? 'spinning' : ''} />
            <span className="header-toggle-label">
              {autoRefresh ? t('layout.autoRefreshOn') : t('layout.autoRefreshOff')}
            </span>
          </button>

          {/* Refresh manuel */}
          <button className="btn-icon" onClick={onRefresh} disabled={loading} title={t('common.refresh')} type="button">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>

          {/* Clear cache */}
          <button className="btn-icon" onClick={onClearCache} title={t('layout.clearCache')} type="button">
            <Settings size={16} />
          </button>

          {/* Auth */}
          {isAuthenticated && user ? (
            <div
              className="user-badge"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <User size={16} />
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-color)' }}>
                {user.name}
                {isAdmin && <span style={{ fontSize: '0.75rem', marginLeft: '4px', color: 'var(--text-secondary)' }}>{t('layout.adminBadge')}</span>}
              </span>
              <button className="btn-icon" onClick={onLogout} title={t('layout.logout')} type="button">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              className="btn-toggle"
              onClick={onLogin}
              title={t('auth.login')}
              type="button"
              style={{ backgroundColor: 'var(--action-auth-bg)', color: 'var(--action-auth-text)', border: 'none' }}
            >
              <LogIn size={16} />
              {t('layout.loginGitLab')}
            </button>
          )}

          {/* Statut backend */}
          <BackendStatus status={backendStatus} t={t} />
        </div>
      )}
      </header>

      {isMobile && (
        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={t('layout.settings')}
        >
          <div className="mobile-drawer-controls">
            {/* Toggle TV Mode */}
            <button
              className={`btn-toggle ${tvMode ? 'active' : ''}`}
              onClick={toggleTvMode}
              type="button"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Monitor size={16} />
              {tvMode ? t('layout.tvModeOn') : t('layout.tvModeOff')}
            </button>

            {/* Toggle Compact Mode */}
            <button
              className={`btn-toggle ${compactMode ? 'active' : ''}`}
              onClick={toggleCompactMode}
              type="button"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <LayoutTemplate size={16} />
              {compactMode ? t('layout.compactModeOn') : t('layout.compactModeOff')}
            </button>

            {/* Toggle Dark Theme */}
            <div className="switch-container" style={{ justifyContent: 'space-between', padding: '12px 0' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('layout.darkTheme')}</span>
              <label className="theme-switch" aria-label={t('layout.darkTheme')}>
                <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
                <span className="slider round" />
              </label>
            </div>

            {/* Sélecteur Dashboard */}
            <select
              value={currentPath}
              onChange={onDashboardChange}
              className="project-selector"
              style={{ width: '100%' }}
              aria-label={t('layout.selectDashboard')}
            >
              {dashboardRoutes.map((route) => (
                <option key={route.path} value={route.path}>
                  {route.label}
                </option>
              ))}
            </select>

            {/* Exports */}
            {currentPath === '/global-view' && exportHandler && (
              <button className="btn-icon" style={{ width: '100%', justifyContent: 'center' }} onClick={exportHandler} type="button">
                <Download size={16} /> {t('layout.exportPdf')}
              </button>
            )}
            {currentPath === '/global-view' && onExportPdfBackend && (
              <button className="btn-icon" style={{ width: '100%', justifyContent: 'center', backgroundColor: 'var(--action-secondary-bg)', color: 'var(--action-secondary-text)' }} onClick={onExportPdfBackend} type="button">
                <Download size={16} /> {t('layout.exportPdfBackend')}
              </button>
            )}
            {currentPath === '/global-view' && onExportCSV && (
              <button className="btn-icon" style={{ width: '100%', justifyContent: 'center', backgroundColor: 'var(--action-success-bg)', color: 'var(--action-success-text)' }} onClick={onExportCSV} type="button">
                <FileText size={16} /> {t('layout.exportCsv')}
              </button>
            )}
            {currentPath === '/global-view' && onExportExcel && (
              <button className="btn-icon" style={{ width: '100%', justifyContent: 'center', backgroundColor: 'var(--action-primary-bg)', color: 'var(--action-primary-text)' }} onClick={onExportExcel} type="button">
                <FileSpreadsheet size={16} /> {t('layout.exportExcel')}
              </button>
            )}

            {/* Toggle Vocabulaire Métier */}
            <div className="switch-container" style={{ justifyContent: 'space-between', padding: '12px 0' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('layout.businessTerms')}</span>
              <label className="theme-switch" aria-label={t('layout.businessTerms')}>
                <input type="checkbox" checked={useBusinessTerms} onChange={() => setUseBusinessTerms(!useBusinessTerms)} />
                <span className="slider round" />
              </label>
            </div>

            {/* Langue */}
            <button className="btn-toggle" onClick={() => changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')} type="button" style={{ width: '100%', justifyContent: 'center' }}>
              <Globe size={16} />
              {i18n.language === 'fr' ? 'FR' : 'EN'}
            </button>

            {/* Auto-refresh */}
            <button className={`btn-toggle ${autoRefresh ? 'active' : ''}`} onClick={() => setAutoRefresh(!autoRefresh)} type="button" style={{ width: '100%', justifyContent: 'center' }}>
              <RefreshCw size={16} className={autoRefresh ? 'spinning' : ''} />
              {autoRefresh ? t('layout.autoRefreshOn') : t('layout.autoRefreshOff')}
            </button>

            {/* Refresh + Clear Cache */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-icon" onClick={onRefresh} disabled={loading} type="button" style={{ flex: 1, justifyContent: 'center' }}>
                <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              </button>
              <button className="btn-icon" onClick={onClearCache} type="button" style={{ flex: 1, justifyContent: 'center' }}>
                <Settings size={16} />
              </button>
            </div>

            {/* Auth */}
            {isAuthenticated && user ? (
              <div className="user-badge" style={{ justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  <User size={16} style={{ display: 'inline', marginRight: 6 }} />
                  {user.name}
                  {isAdmin && <span style={{ fontSize: '0.75rem', marginLeft: 4, color: 'var(--text-secondary)' }}>{t('layout.adminBadge')}</span>}
                </span>
                <button className="btn-icon" onClick={onLogout} type="button">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button className="btn-toggle" onClick={onLogin} type="button" style={{ width: '100%', justifyContent: 'center', backgroundColor: 'var(--action-auth-bg)', color: 'var(--action-auth-text)', border: 'none' }}>
                <LogIn size={16} />
                {t('layout.loginGitLab')}
              </button>
            )}

            {/* Backend Status */}
            <BackendStatus status={backendStatus} t={t} />
          </div>
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
          {lastUpdate && (
            <span className="last-update">{t('layout.footer.lastUpdate')}: {lastUpdate.toLocaleTimeString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')}</span>
          )}
          <span>{t('layout.footer.standards')}</span>
        </div>
      </footer>
    </div>
  );
}
