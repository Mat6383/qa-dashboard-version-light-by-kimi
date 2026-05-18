/**
 * ================================================
 * CHARTS — Pure helpers for Chart.js data construction
 * ================================================
 * Extracted from components to be testable and fix CSS variable issues.
 */

export interface HistoricalSnapshot {
  date: string;
  pass_rate: number | null;
  completion_rate: number | null;
  escape_rate: number | null;
  detection_rate: number | null;
  blocked_rate: number | null;
  total_tests: number | null;
}

export interface CompareItem {
  projectId: number;
  projectName: string;
  passRate: number;
  completionRate: number;
  escapeRate: number;
  detectionRate: number;
  blockedRate: number;
}

// Chart.js cannot resolve CSS variables inside a <canvas> context.
// We map them to static hex colors that match the app's theme.
const HISTORICAL_COLORS: Record<string, { border: string; background: string }> = {
  pass_rate: { border: '#10B981', background: 'rgba(16, 185, 129, 0.12)' },
  completion_rate: { border: '#3B82F6', background: 'rgba(59, 130, 246, 0.12)' },
  escape_rate: { border: '#EF4444', background: 'rgba(239, 68, 68, 0.12)' },
  detection_rate: { border: '#6B7280', background: 'rgba(107, 114, 128, 0.12)' },
  blocked_rate: { border: '#F59E0B', background: 'rgba(245, 158, 11, 0.12)' },
};

const COMPARE_COLORS = [
  { border: '#3B82F6', background: 'rgba(59, 130, 246, 0.12)' },
  { border: '#10B981', background: 'rgba(16, 185, 129, 0.12)' },
  { border: '#F59E0B', background: 'rgba(245, 158, 11, 0.12)' },
  { border: '#EF4444', background: 'rgba(239, 68, 68, 0.12)' },
  { border: '#6B7280', background: 'rgba(107, 114, 128, 0.12)' },
];

export function buildHistoricalChartData(data: HistoricalSnapshot[]) {
  const labels = data.map((d) => d.date);

  const makeDataset = (label: string, key: keyof HistoricalSnapshot) => {
    const colors = HISTORICAL_COLORS[key] || HISTORICAL_COLORS.pass_rate;
    return {
      label,
      data: data.map((d) => (d[key] != null ? parseFloat((d[key] as number).toFixed(2)) : null)),
      borderColor: colors.border,
      backgroundColor: colors.background,
      fill: false,
      tension: 0.3,
      pointRadius: 3,
    };
  };

  return {
    labels,
    datasets: [
      makeDataset('Pass Rate', 'pass_rate'),
      makeDataset('Completion', 'completion_rate'),
      makeDataset('Escape Rate', 'escape_rate'),
      makeDataset('Detection', 'detection_rate'),
      makeDataset('Blocked Rate', 'blocked_rate'),
    ],
  };
}

export function buildCompareChartData(data: CompareItem[]) {
  const labels = ['Pass Rate', 'Completion', 'Escape Rate', 'Detection', 'Blocked'];

  const datasets = data.map((d, i) => {
    const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
    return {
      label: d.projectName,
      data: [d.passRate, d.completionRate, d.escapeRate, d.detectionRate, d.blockedRate],
      borderColor: color.border,
      backgroundColor: color.background,
      pointRadius: 4,
    };
  });

  return { labels, datasets };
}

// ── Chart.js theme colors (Chart.js cannot resolve CSS variables in canvas) ──

const THEME_COLORS = {
  light: {
    text: '#1F2937',
    textMuted: '#6B7280',
    textSecondary: '#4B5563',
    border: '#E5E7EB',
  },
  dark: {
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    textSecondary: '#D1D5DB',
    border: '#374151',
  },
};

export type ChartType = 'line' | 'radar' | 'bar' | 'doughnut';

export interface DoughnutRawData {
  passed: number;
  failed: number;
  wip: number;
  blocked: number;
  untested: number;
}

export function buildDoughnutChartData(raw: DoughnutRawData, useBusiness: boolean, isDark: boolean) {
  const labels = useBusiness
    ? ['Réussis', 'Échoués', 'En cours', 'Bloqués', 'Non testés']
    : ['Passed', 'Failed', 'WIP', 'Blocked', 'Untested'];

  const data = [raw.passed, raw.failed, raw.wip, raw.blocked, raw.untested];

  const colors = isDark
    ? ['#34D399', '#F87171', '#60A5FA', '#FBBF24', '#9CA3AF']
    : ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#6B7280'];

  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors,
        borderColor: isDark ? '#1F2937' : '#FFFFFF',
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };
}

export function buildChartOptions(type: ChartType, isDark: boolean): any {
  const c = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: c.text,
          font: { size: 12, weight: 600 },
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
  };

  if (type === 'line' || type === 'bar') {
    return {
      ...base,
      plugins: {
        ...base.plugins,
        legend: {
          position: 'top' as const,
          labels: { color: c.text, font: { size: 12, weight: 600 } },
        },
      },
      scales: {
        x: {
          grid: { color: c.border },
          ticks: { color: c.textMuted },
        },
        y: {
          grid: { color: c.border },
          ticks: { color: c.textMuted },
          min: 0,
          max: type === 'line' ? 100 : undefined,
        },
      },
    };
  }

  if (type === 'radar') {
    return {
      ...base,
      plugins: {
        ...base.plugins,
        legend: {
          labels: { color: c.text },
        },
      },
      scales: {
        r: {
          ticks: { color: c.textMuted, backdropColor: 'transparent' },
          grid: { color: c.border },
          pointLabels: { color: c.text },
          min: 0,
          max: 100,
        },
      },
    };
  }

  if (type === 'doughnut') {
    return {
      ...base,
      cutout: '65%',
      plugins: {
        ...base.plugins,
        legend: {
          position: 'right' as const,
          labels: {
            color: c.textSecondary,
            font: { size: 12, weight: 'bold' as const },
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle' as const,
          },
        },
      },
    };
  }

  return base;
}
