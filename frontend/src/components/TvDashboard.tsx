import React, { useState, useEffect } from 'react';
import { Settings, BarChart2, Shield, AlertTriangle, PlayCircle, CheckCircle2, XCircle, Clock, RefreshCw, CircleDashed, RotateCcw } from 'lucide-react';
import '../styles/TvDashboard.css';

const TvDashboard = ({ metrics, project, isDark, useBusiness }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentDate(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!metrics) {
        return <div className="tv-dashboard" style={{ justifyContent: 'center', alignItems: 'center' }}>Chargement des données TV...</div>;
    }

    // Calculate global state
    const isCritical = metrics.passRate < 80 || metrics.lean?.wipTotal > 20 || metrics.itil?.changeFailRate > 20;
    const isWarning = metrics.passRate >= 80 && metrics.passRate < 90;
    const globalStateClass = isCritical ? 'critical' : (isWarning ? 'warning' : 'ok');
    const globalStateText = isCritical ? 'CRITIQUE' : (isWarning ? 'ATTENTION' : 'OK');

    return (
        <div className={`tv-dashboard ${isDark ? 'tv-dark-theme' : ''}`}>
            {/* Top Header */}
            <div className="tv-header-info">
                <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={16} /> NEO-FUGU — Dashboard QA Testmo
                </span>
            </div>
            <div className="tv-header-meta">
                Généré le {currentDate.toLocaleDateString('fr-FR')} {currentDate.toLocaleTimeString('fr-FR')} • ISTQB • LEAN • ITIL • Refresh auto 5min
            </div>

            {/* Global State Badge */}
            <div className="tv-global-state">
                <div className={`state-badge ${globalStateClass}`}>
                    <div className="state-title">ÉTAT GLOBAL QA</div>
                    <div className="state-value">
                        <span className={`legend-dot ${globalStateClass}`}></span>
                        {globalStateText}
                    </div>
                    {isCritical && <div className="state-action tv-color-red">Action requise</div>}
                </div>
            </div>

            {/* Legends */}
            <div className="tv-legend">
                <div className="legend-item"><span className="legend-dot ok"></span> OK</div>
                <div className="legend-item"><span className="legend-dot attention"></span> Attention</div>
                <div className="legend-item"><span className="legend-dot critique"></span> Critique</div>
                <div>| {useBusiness ? 'Succès' : 'Pass'} ≥80%</div>
                <div>MTTR ≤72h</div>
                <div>WIP ≤20</div>
                <div>CFR ≤20%</div>
            </div>

            {/* Main Project Card */}
            <div className="tv-project-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div className="project-header" style={{ marginBottom: 0 }}>
                        <div className="project-subtitle">
                            🏆 PROJET PRINCIPAL
                        </div>
                        <h2 className="project-title">{project?.name || 'Neo-Pilot'}</h2>
                        <div className="project-tags">
                            {metrics.lean?.activeRuns} actifs • 163 total • {metrics.istqb?.milestonesCompleted}/{metrics.istqb?.milestonesTotal} {useBusiness ? 'jalons' : 'milestones'}
                        </div>
                    </div>

                    {(isWarning || isCritical) && (
                        <div className="tv-vigilance">
                            <h4><AlertTriangle size={16} /> ATTENTION</h4>
                            <p>Points de vigilance detectés sur les KPIs en dessous des objectifs.</p>
                        </div>
                    )}
                </div>

                {/* ISTQB Section */}
                <div className="kpi-section">
                    <div className="kpi-section-title"><BarChart2 size={16} /> ISTQB</div>
                    <div className="kpi-grid">
                        <div className="kpi-card">
                            <div className="kpi-card-title">ISTQB<br />{useBusiness ? 'Taux Succès Moy.' : 'Avg Pass Rate'}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', justifyContent: 'center' }}>
                                <div className={`kpi-card-value ${(metrics.istqb?.avgPassRate >= metrics.istqb?.passRateTarget) ? 'success' : (metrics.istqb?.avgPassRate >= metrics.istqb?.passRateTarget - 5) ? 'warning' : 'danger'}`}>
                                    {metrics.istqb?.avgPassRate}%
                                </div>
                                <span style={{ fontSize: '1.2rem', color: (metrics.istqb?.avgPassRate >= metrics.istqb?.passRateTarget) ? 'var(--text-success)' : 'var(--text-danger)' }}>
                                    {(metrics.istqb?.avgPassRate >= metrics.istqb?.passRateTarget) ? '▲' : '▼'}
                                </span>
                            </div>
                            <div className="kpi-card-target">Cible: ≥ {metrics.istqb?.passRateTarget}%</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-card-title">ISTQB<br />{useBusiness ? 'Jalons' : 'Milestones'}</div>
                            <div className="kpi-card-value warning">
                                {metrics.istqb?.milestonesCompleted}/{metrics.istqb?.milestonesTotal}
                            </div>
                            <div className="kpi-card-target">{metrics.istqb?.milestonesTotal ? Math.round((metrics.istqb.milestonesCompleted / metrics.istqb.milestonesTotal) * 100) : 0}%</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-card-title">ISTQB<br />{useBusiness ? 'Taux de Blocage' : 'Block Rate'}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', justifyContent: 'center' }}>
                                <div className={`kpi-card-value ${(metrics.istqb?.blockRate <= metrics.istqb?.blockRateTarget) ? 'success' : (metrics.istqb?.blockRate <= metrics.istqb?.blockRateTarget + 5) ? 'warning' : 'danger'}`}>
                                    {metrics.istqb?.blockRate}%
                                </div>
                                <span style={{ fontSize: '1.2rem', color: (metrics.istqb?.blockRate <= metrics.istqb?.blockRateTarget) ? 'var(--text-success)' : 'var(--text-danger)' }}>
                                    {(metrics.istqb?.blockRate <= metrics.istqb?.blockRateTarget) ? '▼' : '▲'}
                                </span>
                            </div>
                            <div className="kpi-card-target">Cible: ≤ {metrics.istqb?.blockRateTarget}%</div>
                        </div>
                    </div>
                </div>

                {/* ITIL Section */}
                <div className="kpi-section">
                    <div className="kpi-section-title"><Settings size={16} /> ITIL</div>
                    <div className="kpi-grid">
                        <div className="kpi-card">
                            <div className="kpi-card-title">ITIL<br />{useBusiness ? 'Temps Moyen Résolution' : 'MTTR Moyen'}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', justifyContent: 'center' }}>
                                <div className={`kpi-card-value ${(metrics.itil?.mttr <= metrics.itil?.mttrTarget) ? 'success' : (metrics.itil?.mttr <= metrics.itil?.mttrTarget + 24) ? 'warning' : 'danger'}`}>
                                    {metrics.itil?.mttr}h
                                </div>
                                <span style={{ fontSize: '1.2rem', color: (metrics.itil?.mttr <= metrics.itil?.mttrTarget) ? 'var(--text-success)' : 'var(--text-danger)' }}>
                                    {(metrics.itil?.mttr <= metrics.itil?.mttrTarget) ? '▼' : '▲'}
                                </span>
                            </div>
                            <div className="kpi-card-target">Cible: ≤ {metrics.itil?.mttrTarget}h</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-card-title">ITIL<br />{useBusiness ? 'Délai Livraison' : 'Lead Time'}</div>
                            <div className={`kpi-card-value ${(metrics.itil?.leadTime <= metrics.itil?.leadTimeTarget) ? 'info' : 'danger'}`}>
                                {metrics.itil?.leadTime}h
                            </div>
                            <div className="kpi-card-target">≤ {metrics.itil?.leadTimeTarget}h</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-card-title">ITIL<br />{useBusiness ? 'Taux Échec Changement' : 'Change Fail Rate'}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', justifyContent: 'center' }}>
                                <div className={`kpi-card-value ${(metrics.itil?.changeFailRate <= metrics.itil?.changeFailRateTarget) ? 'success' : (metrics.itil?.changeFailRate <= metrics.itil?.changeFailRateTarget + 10) ? 'warning' : 'danger'}`}>
                                    {metrics.itil?.changeFailRate}%
                                </div>
                                <span style={{ fontSize: '1.2rem', color: (metrics.itil?.changeFailRate <= metrics.itil?.changeFailRateTarget) ? 'var(--text-success)' : 'var(--text-danger)' }}>
                                    {(metrics.itil?.changeFailRate <= metrics.itil?.changeFailRateTarget) ? '▼' : '▲'}
                                </span>
                            </div>
                            <div className="kpi-card-target">Cible: ≤ {metrics.itil?.changeFailRateTarget}%</div>
                        </div>
                    </div>
                </div>

                {/* LEAN Section */}
                <div className="kpi-section">
                    <div className="kpi-section-title"><RefreshCw size={16} /> LEAN</div>
                    <div className="kpi-grid">
                        <div className="kpi-card">
                            <div className="kpi-card-title">LEAN<br />{useBusiness ? 'En-cours (WIP)' : 'WIP Total'}</div>
                            <div className={`kpi-card-value ${(metrics.lean?.wipTotal <= metrics.lean?.wipTarget) ? 'success' : 'warning'}`}>
                                {metrics.lean?.wipTotal}
                            </div>
                            <div className="kpi-card-target">≤ {metrics.lean?.wipTarget}</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-card-title">LEAN<br />{useBusiness ? 'Campagnes Actives' : 'Runs Actifs'}</div>
                            <div className="kpi-card-value success">
                                {metrics.lean?.activeRuns}
                            </div>
                            <div className="kpi-card-target">En cours</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-card-title">LEAN<br />{useBusiness ? 'Campagnes Clôturées' : 'Runs Fermés'}</div>
                            <div className="kpi-card-value info">
                                {metrics.lean?.closedRuns}
                            </div>
                            <div className="kpi-card-target">Complétés</div>
                        </div>
                    </div>
                </div>

                {/* Runs List TV Style */}
                <div className="tv-runs-list">
                    <h3><RefreshCw size={16} /> {useBusiness ? 'Campagnes Actives' : 'Runs Actifs'} ({metrics.runs?.length})</h3>

                    {metrics.runs && metrics.runs.map((run) => (
                        <div className="tv-run-card" key={run.id}>
                            <div className="tv-run-header">
                                <div className="tv-run-name"><RefreshCw size={16} /> {run.name}</div>
                                <div className="tv-run-age"><Clock size={14} /> ID: {run.id}</div>
                            </div>

                            <div className="tv-run-progress">
                                <div className="tv-run-progress-col" style={{ flex: '2', marginRight: '2rem' }}>
                                    <div className="tv-run-progress-label">{useBusiness ? 'Progression' : 'Progress'}</div>
                                    <div className="tv-run-progress-bar-bg">
                                        <div className="tv-run-progress-bar-fill" style={{ width: `${run.completionRate}%` }}></div>
                                    </div>
                                    <div className="tv-run-progress-text">{run.completionRate}%</div>
                                </div>

                                <div className="tv-run-passrate">
                                    <div className="tv-run-passrate-label"><CheckCircle2 className="ok" size={14} /> {useBusiness ? 'Taux de succès' : 'Pass Rate'}</div>
                                    <div className={`tv-run-passrate-value ${(run.passRate >= 80) ? 'tv-color-green' : 'tv-color-yellow'}`}>
                                        {run.passRate}%
                                    </div>
                                </div>
                            </div>

                            <div className="tv-run-metrics-grid">
                                <div className="tv-run-metric">
                                    <div className="tv-run-metric-label"><XCircle size={12} /> {useBusiness ? 'Échecs' : 'Failures'}</div>
                                    <div className="tv-run-metric-value tv-color-red">{run.failed !== undefined ? run.failed : '...'}</div>
                                </div>
                                <div className="tv-run-metric">
                                    <div className="tv-run-metric-label"><AlertTriangle size={12} /> {useBusiness ? 'Bloqués' : 'Blocked'}</div>
                                    <div className="tv-run-metric-value tv-color-red">{run.blocked !== undefined ? run.blocked : '...'}</div>
                                </div>
                                <div className="tv-run-metric">
                                    <div className="tv-run-metric-label"><Clock size={12} /> {useBusiness ? 'En cours' : 'WIP'}</div>
                                    <div className="tv-run-metric-value tv-color-yellow">{run.wip !== undefined ? run.wip : '...'}</div>
                                </div>
                                <div className="tv-run-metric">
                                    <div className="tv-run-metric-label">⏭ {useBusiness ? 'Ignorés' : 'Skipped'}</div>
                                    <div className="tv-run-metric-value tv-color-gray">{run.skipped !== undefined ? run.skipped : '...'}</div>
                                </div>
                                <div className="tv-run-metric">
                                    <div className="tv-run-metric-label"><RotateCcw size={12} /> {useBusiness ? 'À retester' : 'Retest'}</div>
                                    <div className="tv-run-metric-value" style={{ color: 'var(--text-secondary)' }}>{run.retest !== undefined ? run.retest : '...'}</div>
                                </div>
                                <div className="tv-run-metric">
                                    <div className="tv-run-metric-label"><CircleDashed size={12} /> {useBusiness ? 'Non testés' : 'Untested'}</div>
                                    <div className="tv-run-metric-value" style={{ color: 'var(--text-muted)' }}>{run.untested !== undefined ? run.untested : '...'}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};

export default TvDashboard;
