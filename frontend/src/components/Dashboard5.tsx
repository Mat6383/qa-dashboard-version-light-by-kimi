import React, { useState, useEffect, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  History,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import apiService from '../services/api.service';
import type { ChartOptions } from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const Dashboard5 = ({ projectId, isDark, useBusiness }) => {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTrends = async () => {
      try {
        setLoading(true);
        const response = await apiService.getAnnualTrends(projectId) as any;
        if (controller.signal.aborted) return;
        setTrends(response.data || []);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error fetching trends:', err);
        setError('Impossible de charger les tendances annuelles.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    if (projectId) {
      fetchTrends();
    }
    return () => controller.abort();
  }, [projectId]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'var(--text-color)',
            font: { size: 12, weight: 600 },
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
      },
      scales: {
        x: {
          grid: { color: 'var(--border-color)' },
          ticks: { color: 'var(--text-muted)' },
        },
        y: {
          grid: { color: 'var(--border-color)' },
          ticks: { color: 'var(--text-muted)' },
        },
      },
    } satisfies ChartOptions<'line'>),
    [isDark]
  );

  const qualityTrendData = useMemo(
    () => ({
      labels: trends.map((t) => t.version),
      datasets: [
        {
          label: useBusiness ? 'Taux de Détection (DDP)' : 'Detection Rate (DDP)',
          data: trends.map((t) => t.detectionRate),
          borderColor: 'var(--text-success)',
          backgroundColor: 'color-mix(in srgb, var(--text-success) 10%, transparent)',
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointHoverRadius: 8,
          borderWidth: 3,
        },
        {
          label: useBusiness ? "Taux d'Échappement" : 'Escape Rate',
          data: trends.map((t) => t.escapeRate),
          borderColor: 'var(--text-danger)',
          backgroundColor: 'color-mix(in srgb, var(--text-danger) 10%, transparent)',
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointHoverRadius: 8,
          borderWidth: 3,
        },
      ],
    }),
    [trends, useBusiness]
  );

  const volumeTrendData = useMemo(
    () => ({
      labels: trends.map((t) => t.version),
      datasets: [
        {
          label: useBusiness ? 'Bugs détectés en Test' : 'Bugs found in Test',
          data: trends.map((t) => t.bugsInTest),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderRadius: 4,
        },
        {
          label: useBusiness ? 'Bugs échappés en Prod' : 'Bugs escaped in Prod',
          data: trends.map((t) => t.bugsInProd),
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderRadius: 4,
        },
      ],
    }),
    [trends, useBusiness]
  );

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          color: 'var(--text-color)',
        }}
      >
        <Loader2 className="animate-spin" size={48} />
        <p style={{ marginTop: '1rem', fontSize: '1.2rem' }}>Analyse des tendances historiques en cours...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          color: 'var(--text-danger)',
        }}
      >
        <AlertCircle size={48} />
        <p style={{ marginTop: '1rem', fontSize: '1.2rem' }}>{error}</p>
      </div>
    );
  }

  const latest = trends[trends.length - 1] || {};
  const previous = trends[trends.length - 2] || {};

  const getTrendIcon = (curr, prev) => {
    if (curr > prev) return <ArrowUpRight size={20} color="var(--text-danger)" />;
    if (curr < prev) return <ArrowDownRight size={20} color="var(--text-success)" />;
    return null;
  };

  return (
    <div className={`dashboard-fade-in ${isDark ? 'tv-dark-theme' : ''}`} style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: 'var(--action-primary-bg)', padding: '0.5rem', borderRadius: '8px', color: 'var(--action-primary-text)' }}>
            <TrendingUp size={24} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-color)' }}>
            {useBusiness ? 'TENDANCES ANNUELLES DE QUALITÉ' : 'ANNUAL QUALITY TRENDS'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Calendar size={16} /> Jan 2025 - Dec 2025
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <History size={16} /> {trends.length} {useBusiness ? 'Versions analysées' : 'Versions analyzed'}
          </span>
        </div>
      </div>

      {/* Top Summary Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            borderLeft: '6px solid #10B981',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            DDP Actuel
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-color)' }}>
              {latest.detectionRate}%
            </span>
            {getTrendIcon(latest.detectionRate, previous.detectionRate)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            borderLeft: '6px solid #EF4444',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Escape Rate Actuel
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-color)' }}>
              {latest.escapeRate}%
            </span>
            {getTrendIcon(latest.escapeRate, previous.escapeRate)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            borderLeft: '6px solid #3B82F6',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Bugs (Année)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-color)', marginTop: '0.25rem' }}>
            {trends.reduce((acc, t) => acc + t.totalBugs, 0)}
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            borderLeft: '6px solid #F59E0B',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Stabilité Versions
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-color)', marginTop: '0.25rem' }}>
            {trends.length ? Math.round((trends.filter((t) => t.escapeRate < 5).length / trends.length) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            height: '400px',
          }}
        >
          <h3
            style={{
              margin: '0 0 1rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-color)',
            }}
          >
            <ShieldCheck size={20} color="#10B981" />{' '}
            {useBusiness ? 'Efficacité Qualité (DDP vs Escape)' : 'Quality Efficiency Trend'}
          </h3>
          <div style={{ height: '320px' }}>
            <Line data={qualityTrendData} options={chartOptions} />
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            height: '400px',
          }}
        >
          <h3
            style={{
              margin: '0 0 1rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-color)',
            }}
          >
            <ShieldAlert size={20} color="#EF4444" />{' '}
            {useBusiness ? 'Volume de Defectologie par Version' : 'Defect Volume per Version'}
          </h3>
          <div style={{ height: '320px' }}>
            <Bar
              data={volumeTrendData}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  x: { ...chartOptions.scales.x, stacked: true },
                  y: { ...chartOptions.scales.y, stacked: true },
                },
              } satisfies ChartOptions<'bar'>}
            />
          </div>
        </div>
      </div>

      {/* Detailed Table Section */}
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          padding: '1.5rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-color)' }}>
          {useBusiness ? 'Détails Historiques par Version' : 'Historical Version Details'}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-color)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>Version</th>
                <th style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>Date</th>
                <th style={{ padding: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Test Bugs</th>
                <th style={{ padding: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Prod Bugs</th>
                <th style={{ padding: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>DDP %</th>
                <th style={{ padding: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Escape %</th>
                <th style={{ padding: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {trends
                .map((t, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{t.version}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{new Date(t.date).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{t.bugsInTest}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{t.bugsInProd}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-success)' }}>
                      {t.detectionRate}%
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                        fontWeight: 700,
                        color: getMetricColor('escapeRate', t.escapeRate),
                      }}
                    >
                      {t.escapeRate}%
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: getMetricBgColor('escapeRate', t.escapeRate),
                          color: getMetricColor('escapeRate', t.escapeRate),
                        }}
                      >
                        {getMetricLevel('escapeRate', t.escapeRate) === 'success' ? 'EXCELLENT' : getMetricLevel('escapeRate', t.escapeRate) === 'warning' ? 'ACCEPTABLE' : 'CRITICAL'}
                      </span>
                    </td>
                  </tr>
                ))
                .reverse()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard5;
