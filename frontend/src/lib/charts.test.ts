import { describe, it, expect } from 'vitest';
import { buildHistoricalChartData, buildCompareChartData, buildCompareRequestConfig, buildChartOptions, buildDoughnutChartData } from './charts';

describe('buildHistoricalChartData', () => {
  const snapshots = [
    { date: '2026-05-13', pass_rate: 99.0, completion_rate: 100.0, escape_rate: null, detection_rate: null, blocked_rate: 0.0, total_tests: 10 },
    { date: '2026-05-18', pass_rate: 80.25, completion_rate: 92.05, escape_rate: 5.0, detection_rate: 95.0, blocked_rate: 0.0, total_tests: 88 },
  ];

  it('utilise des couleurs hex valides, pas de CSS variables', () => {
    const chartData = buildHistoricalChartData(snapshots);
    for (const ds of chartData.datasets) {
      expect(ds.borderColor).not.toContain('var(--');
      expect(ds.backgroundColor).not.toContain('var(--');
      // La couleur de fond doit être une couleur valide (hex ou rgba)
      const bg = ds.backgroundColor as string;
      const isHex = /^#[0-9A-Fa-f]{6,8}$/.test(bg);
      const isRgba = /^rgba?\(/.test(bg);
      expect(isHex || isRgba).toBe(true);
    }
  });

  it('utilise le champ date pour les labels', () => {
    const chartData = buildHistoricalChartData(snapshots);
    expect(chartData.labels).toEqual(['2026-05-13', '2026-05-18']);
  });

  it('mappe correctement les valeurs des métriques', () => {
    const chartData = buildHistoricalChartData(snapshots);
    const passRateDs = chartData.datasets.find((d) => d.label === 'Pass Rate');
    expect(passRateDs?.data).toEqual([99.0, 80.25]);
  });

  it('gère les valeurs null en les remplaçant par null dans le dataset', () => {
    const chartData = buildHistoricalChartData(snapshots);
    const escapeDs = chartData.datasets.find((d) => d.label === 'Escape Rate');
    expect(escapeDs?.data).toEqual([null, 5.0]);
  });
});

describe('buildCompareChartData', () => {
  const compareItems = [
    {
      projectId: 1,
      projectName: 'Neo-Pilot',
      passRate: 80.25,
      completionRate: 92.05,
      escapeRate: 0,
      detectionRate: 0,
      blockedRate: 0,
    },
    {
      projectId: 3,
      projectName: 'Workshop',
      passRate: 72.22,
      completionRate: 100.0,
      escapeRate: 0,
      detectionRate: 0,
      blockedRate: 0,
    },
  ];

  it('utilise des couleurs hex valides, pas de CSS variables', () => {
    const chartData = buildCompareChartData(compareItems);
    for (const ds of chartData.datasets) {
      expect(ds.borderColor).not.toContain('var(--');
      expect(ds.backgroundColor).not.toContain('var(--');
    }
  });

  it('produit les bonnes dimensions radar', () => {
    const chartData = buildCompareChartData(compareItems);
    expect(chartData.labels).toEqual(['Pass Rate', 'Completion', 'Escape Rate', 'Detection', 'Blocked']);
    expect(chartData.datasets).toHaveLength(2);
  });

  it('mappe les données dans le bon ordre', () => {
    const chartData = buildCompareChartData(compareItems);
    const neoPilot = chartData.datasets.find((d) => d.label === 'Neo-Pilot');
    expect(neoPilot?.data).toEqual([80.25, 92.05, 0, 0, 0]);
  });
});

describe('buildCompareRequestConfig', () => {
  it('sérialise les arrays sans brackets pour FastAPI', () => {
    const config = buildCompareRequestConfig([1, 3]);
    // Axios avec paramsSerializer: { indexes: null } produit ?project_ids=1&project_ids=3
    expect(config.params).toEqual({ project_ids: [1, 3] });
    expect(config.paramsSerializer).toEqual({ indexes: null });
  });
});

describe('buildDoughnutChartData', () => {
  const raw = { passed: 65, failed: 13, wip: 2, blocked: 0, untested: 4, skipped: 3, total: 88, completed: 81, success: 65, failure: 13 };

  it('utilise des couleurs hex valides, pas de CSS variables', () => {
    const chartData = buildDoughnutChartData(raw, true, false);
    const bgColors = chartData.datasets[0].backgroundColor as string[];
    for (const c of bgColors) {
      expect(c).not.toContain('var(--');
    }
    expect(chartData.datasets[0].borderColor).not.toContain('var(--');
  });

  it('mappe les bonnes données dans le bon ordre', () => {
    const chartData = buildDoughnutChartData(raw, true, false);
    expect(chartData.labels).toEqual(['Réussis', 'Échoués', 'En cours', 'Bloqués', 'Non testés']);
    expect(chartData.datasets[0].data).toEqual([65, 13, 2, 0, 4]);
  });

  it('utilise les labels anglais quand useBusiness est false', () => {
    const chartData = buildDoughnutChartData(raw, false, false);
    expect(chartData.labels).toEqual(['Passed', 'Failed', 'WIP', 'Blocked', 'Untested']);
  });

  it('adapte les couleurs au thème dark', () => {
    const dark = buildDoughnutChartData(raw, true, true);
    const light = buildDoughnutChartData(raw, true, false);
    const darkBg = dark.datasets[0].backgroundColor as string[];
    const lightBg = light.datasets[0].backgroundColor as string[];
    expect(darkBg[0]).not.toBe(lightBg[0]);
  });
});

describe('buildChartOptions', () => {
  it('ne contient aucune CSS variable dans les couleurs de légende (line)', () => {
    const opts = buildChartOptions('line', false);
    expect(opts.plugins.legend.labels.color).not.toContain('var(--');
  });

  it('ne contient aucune CSS variable dans les couleurs de grille et ticks (line)', () => {
    const opts = buildChartOptions('line', false);
    expect(opts.scales.x.grid.color).not.toContain('var(--');
    expect(opts.scales.x.ticks.color).not.toContain('var(--');
    expect(opts.scales.y.grid.color).not.toContain('var(--');
    expect(opts.scales.y.ticks.color).not.toContain('var(--');
  });

  it('ne contient aucune CSS variable dans les couleurs radar', () => {
    const opts = buildChartOptions('radar', false);
    expect(opts.plugins.legend.labels.color).not.toContain('var(--');
    expect(opts.scales.r.grid.color).not.toContain('var(--');
    expect(opts.scales.r.ticks.color).not.toContain('var(--');
    expect(opts.scales.r.pointLabels.color).not.toContain('var(--');
  });

  it('ne contient aucune CSS variable dans les couleurs doughnut', () => {
    const opts = buildChartOptions('doughnut', false);
    expect(opts.plugins.legend.labels.color).not.toContain('var(--');
  });

  it('adapte les couleurs selon le thème dark (line)', () => {
    const dark = buildChartOptions('line', true);
    const light = buildChartOptions('line', false);
    expect(dark.plugins.legend.labels.color).not.toBe(light.plugins.legend.labels.color);
  });

  it('conserve les propriétés non-couleur intactes', () => {
    const opts = buildChartOptions('line', false);
    expect(opts.responsive).toBe(true);
    expect(opts.maintainAspectRatio).toBe(false);
    expect(opts.plugins.legend.position).toBe('top');
    expect(opts.plugins.tooltip.mode).toBe('index');
  });
});
