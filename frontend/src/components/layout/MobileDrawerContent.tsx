import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw,
  Monitor,
  LayoutTemplate,
  Download,
  FileText,
  FileSpreadsheet,
  Globe,
  Settings,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';

export default function MobileDrawerContent({
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
  autoRefresh,
  setAutoRefresh,
  onRefresh,
  loading,
  onClearCache,
  user,
  isAuthenticated,
  isAdmin,
  onLogin,
  onLogout,
  backendStatus,
}) {
  const { t, i18n } = useTranslation();

  return (
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
      <button className="btn-toggle" onClick={() => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')} type="button" style={{ width: '100%', justifyContent: 'center' }}>
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
      <div className="backend-status" style={{ justifyContent: 'center', marginTop: '8px' }}>
        {backendStatus === 'ok' ? (
          <span style={{ color: 'var(--text-success)', fontSize: '0.875rem' }}>✓ {t('layout.backendStatus.ok')}</span>
        ) : backendStatus === 'error' ? (
          <span style={{ color: 'var(--text-danger)', fontSize: '0.875rem' }}>✗ {t('layout.backendStatus.error')}</span>
        ) : (
          <span style={{ color: 'var(--text-warning)', fontSize: '0.875rem' }}>⟳ {t('layout.backendStatus.checking')}</span>
        )}
      </div>
    </div>
  );
}
