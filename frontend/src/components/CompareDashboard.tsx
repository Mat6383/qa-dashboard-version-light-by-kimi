import React, { useState, useEffect, useMemo } from 'react';
import { Radar } from 'react-chartjs-2';
import { Loader2, AlertCircle, GitCompare } from 'lucide-react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { apiClient } from '../services/api.service';
import { getMetricColor } from '../lib/colors';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function CompareDashboard({ isDark }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get('/projects')
      .then((res) => {
        const raw = res.data?.data?.result || res.data?.data || res.data?.projects || [];
        setProjects(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selected.length < 2) {
      setData([]);
      return;
    }
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/dashboard/compare', {
          params: { projectIds: selected.join(',') },
          signal: controller.signal,
        });
        const raw = res.data?.data || res.data?.projects || [];
        const list = Array.isArray(raw) ? raw : [];
        setData(
          list.map((d) => ({
            projectId: d.projectId ?? d.project_id ?? 0,
            projectName: d.projectName ?? d.project_name ?? `Projet ${d.projectId ?? d.project_id ?? 0}`,
            passRate: d.passRate ?? d.pass_rate ?? 0,
            completionRate: d.completionRate ?? d.completion_rate ?? 0,
            escapeRate: d.escapeRate ?? d.escape_rate ?? 0,
            detectionRate: d.detectionRate ?? d.detection_rate ?? 0,
            blockedRate: d.blockedRate ?? d.blocked_rate ?? 0,
          }))
        );
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError('Erreur lors de la comparaison.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [selected]);

  const chartData = useMemo(() => {
    const labels = ['Pass Rate', 'Completion', 'Escape Rate', 'Detection', 'Blocked'];
    const datasets = data.map((d, i) => ({
      label: d.projectName,
      data: [d.passRate, d.completionRate, d.escapeRate, d.detectionRate, d.blockedRate],
      borderColor: ['var(--text-primary)', 'var(--text-success)', 'var(--text-warning)', 'var(--text-danger)', 'var(--text-secondary)'][i % 5],
      backgroundColor: ['color-mix(in srgb, var(--text-primary) 12%, transparent)', 'color-mix(in srgb, var(--text-success) 12%, transparent)', 'color-mix(in srgb, var(--text-warning) 12%, transparent)', 'color-mix(in srgb, var(--text-danger) 12%, transparent)', 'color-mix(in srgb, var(--text-secondary) 12%, transparent)'][i % 5],
      pointRadius: 4,
    }));
    return { labels, datasets };
  }, [data]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: 'var(--text-color)' } },
      },
      scales: {
        r: {
          ticks: { color: 'var(--text-muted)', backdropColor: 'transparent' },
          grid: { color: 'var(--border-color)' },
          pointLabels: { color: 'var(--text-color)' },
          min: 0,
          max: 100,
        },
      },
    }),
    [isDark]
  );

  const cardBg = 'var(--surface-muted)';
  const border = 'var(--border-color)';
  const text = 'var(--text-color)';

  const toggleProject = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: text }}>
        <GitCompare size={24} />
        Comparateur multi-projets
      </h2>
      <p style={{ color: 'var(--text-secondary)' }}>Sélectionnez 2 à 4 projets à comparer</p>

      {projects.length === 0 && !loading && (
        <div style={{ color: 'var(--text-secondary)', margin: '16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={20} />
          Aucun projet disponible.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '16px 0' }}>
        {projects.map((p) => {
          const active = selected.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggleProject(p.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: `2px solid ${active ? 'var(--text-primary)' : border}`,
                background: active ? 'var(--text-primary)' : cardBg,
                color: active ? '#fff' : text,
                cursor: 'pointer',
                fontWeight: 500,
              }}
              type="button"
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="loading-container">
          <Loader2 size={32} className="spinner" />
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--text-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {!loading && data.length > 0 && (
        <div style={{ height: '500px', background: cardBg, border, borderRadius: '8px', padding: '16px' }}>
          <Radar data={chartData} options={options} />
        </div>
      )}

      {!loading && data.length > 0 && (
        <div style={{ marginTop: '24px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', color: text }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${border}` }}>
                <th style={{ textAlign: 'left', padding: '8px' }}>Projet</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Pass Rate</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Completion</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Escape</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Detection</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Blocked</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.projectId} style={{ borderBottom: `1px solid ${border}` }}>
                  <td style={{ padding: '8px', fontWeight: 500 }}>{d.projectName}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: getMetricColor('passRate', d.passRate), fontWeight: 700 }}>{d.passRate}%</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: getMetricColor('completionRate', d.completionRate), fontWeight: 700 }}>{d.completionRate}%</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: getMetricColor('escapeRate', d.escapeRate), fontWeight: 700 }}>{d.escapeRate}%</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: getMetricColor('detectionRate', d.detectionRate), fontWeight: 700 }}>{d.detectionRate}%</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: getMetricColor('blockedRate', d.blockedRate), fontWeight: 700 }}>{d.blockedRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
