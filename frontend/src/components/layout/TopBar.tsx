import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Activity,
  Database,
  Monitor,
  Download,
  LogIn,
  LogOut,
  User,
  Radio,
  Globe,
  LayoutTemplate,
  Settings,
  Bell,
  BellOff,
} from 'lucide-react';
import ExportMenu from './ExportMenu';
import { usePreferences } from '../../hooks/usePreferences';

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

export default function TopBar({
  projects,
  projectId,
  onProjectChange,
  tvMode,
  toggleTvMode,
  compactMode,
  toggleCompactMode,
  darkMode,
  toggleDarkMode,
  currentPath,
  onDashboardChange,
  dashboardRoutes,
  exportHandler,
  onExportPdfBackend,
  onExportCSV,
  onExportExcel,
  useBusinessTerms,
  setUseBusinessTerms,
  liveConnected,
  liveError,
  lastLiveEventAt,
  autoRefresh,
  setAutoRefresh,
  onRefresh,
  loading,
  onClearCache,
  user,
  isAuthenticated,
  isAdmin,
  onLogin,
  onDevLogin,
  onLogout,
  backendStatus,
}) {
  const { t, i18n } = useTranslation();
  const { showCriticalAlerts, setShowCriticalAlerts } = usePreferences();

  return (
    <header className="app-header" role="banner">
      <div className="header-left">
        <Database size={32} color="var(--text-primary)" />
        <div className="header-title">
          <h1>{t('layout.title')}</h1>
          <p className="header-subtitle">{t('layout.subtitle')}</p>
        </div>
      </div>

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

        {/* Toggle Critical Alerts */}
        <button
          className={`btn-toggle ${showCriticalAlerts ? 'active' : ''}`}
          onClick={() => setShowCriticalAlerts(!showCriticalAlerts)}
          title={showCriticalAlerts ? t('layout.criticalAlertsOn') : t('layout.criticalAlertsOff')}
          type="button"
          data-testid="critical-alerts-toggle"
        >
          {showCriticalAlerts ? <Bell size={16} /> : <BellOff size={16} />}
          <span className="header-toggle-label">
            {showCriticalAlerts ? t('layout.criticalAlertsOn') : t('layout.criticalAlertsOff')}
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
        <ExportMenu
          currentPath={currentPath}
          exportHandler={exportHandler}
          onExportPdfBackend={onExportPdfBackend}
          onExportCSV={onExportCSV}
          onExportExcel={onExportExcel}
          t={t}
        />

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

        {/* Toggle Live Mode */}
        <button
          className={`btn-toggle live-mode-toggle ${autoRefresh ? 'active' : ''} ${liveConnected ? 'live-connected' : ''} ${liveError ? 'live-error' : ''}`}
          onClick={() => setAutoRefresh(!autoRefresh)}
          title={
            liveConnected
              ? t('layout.liveIndicator')
              : liveError
              ? liveError
              : autoRefresh
              ? t('layout.liveConnecting')
              : t('layout.liveModeOff')
          }
          type="button"
        >
          <Radio size={14} className={liveConnected ? 'live-pulse' : ''} />
          <span className="header-toggle-label">
            {liveConnected ? 'LIVE' : liveError ? 'ERR' : autoRefresh ? '...' : 'LIVE OFF'}
          </span>
        </button>

        {/* Sélecteur de langue */}
        <button
          className="btn-toggle"
          onClick={() => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')}
          title={t('common.language')}
          type="button"
        >
          <Globe size={16} />
          {i18n.language === 'fr' ? 'FR' : 'EN'}
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
          <>
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
            {import.meta.env.DEV && (
              <button
                className="btn-toggle"
                onClick={onDevLogin}
                title="Dev Login"
                type="button"
                style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', marginLeft: '8px' }}
              >
                <LogIn size={16} />
                Dev Login
              </button>
            )}
          </>
        )}

        {/* Statut backend */}
        <BackendStatus status={backendStatus} t={t} />
      </div>
    </header>
  );
}
