import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Loader2, AlertCircle, Calendar } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { buildHistoricalChartData, buildChartOptions } from '../lib/charts';
import { useTrends } from '../hooks/queries/useTrends';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function HistoricalTrends({ projectId, isDark }) {
  const [range, setRange] = useState('30'); // jours
  const [granularity, setGranularity] = useState('day');

  const to = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const from = useMemo(
    () => new Date(Date.now() - parseInt(range) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    [range]
  );

  const { data: response, isLoading: loading, error: queryError } = useTrends(projectId, granularity, from, to);

  const data = useMemo(() => response?.snapshots || [], [response]);
  const chartData = useMemo(() => buildHistoricalChartData(data), [data]);
  const options = useMemo(() => buildChartOptions('line', isDark), [isDark]);

  const cardBg = 'var(--surface-muted)';
  const border = 'var(--border-color)';
  const text = 'var(--text-color)';

  const error = queryError instanceof Error ? queryError.message : null;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: text }}>📈 Tendances historiques</h2>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '6px', border, background: cardBg, color: text }}
        >
          <option value="7">7 jours</option>
          <option value="30">30 jours</option>
          <option value="90">90 jours</option>
          <option value="365">1 an</option>
        </select>
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '6px', border, background: cardBg, color: text }}
        >
          <option value="day">Jour</option>
          <option value="week">Semaine</option>
          <option value="month">Mois</option>
        </select>
      </div>

      {loading && (
        <div className="loading-container">
          <Loader2 size={32} className="spinner" />
          <p>Chargement des tendances...</p>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--text-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} />
          Aucune donnée historique disponible. Les snapshots sont collectés quotidiennement.
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div style={{ height: '400px', background: cardBg, border, borderRadius: '8px', padding: '16px' }}>
          <Line data={chartData} options={options} />
        </div>
      )}
    </div>
  );
}
