import { describe, it, expect } from 'vitest';
import { generateQuickClosureDoc } from './docxGenerator';

const mockMetrics = {
  qualityRates: { detectionRate: 85, bugsInTest: 3, bugsInProd: 0, totalBugs: 3, escapeRate: 0 },
  raw: { total: 100, passed: 80, failed: 5, untested: 10, blocked: 3, skipped: 2, completed: 90, retest: 0, wip: 0 },
  completionRate: 90,
  passRate: 80,
  failureRate: 5,
  blockedRate: 3,
  testEfficiency: 88,
  preprodMilestone: 'R06 - Pilot',
  runs: [
    { name: 'Run A', total: 50, completed: 50, passed: 45, failed: 3, completionRate: 100 },
  ],
  runsCount: 1,
};

const mockBugs = [
  { severity: 'Majeur', desc: 'Bug sur le login' },
  { severity: 'Mineur', desc: 'Alignement bouton' },
];

describe('docxGenerator — generateQuickClosureDoc', () => {
  it('retourne un Blob avec les données complètes', async () => {
    const blob = await generateQuickClosureDoc({
      currentMetrics: mockMetrics,
      selectedPastRuns: [],
      project: { name: 'Neo-Pilot' },
      environment: 'Preprod',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      bugs: mockBugs,
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('retourne un Blob même sans bugs', async () => {
    const blob = await generateQuickClosureDoc({
      currentMetrics: mockMetrics,
      selectedPastRuns: [],
      project: { name: 'Test' },
      environment: '',
      startDate: '',
      endDate: '',
      bugs: [],
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('retourne un Blob même sans runs', async () => {
    const blob = await generateQuickClosureDoc({
      currentMetrics: { ...mockMetrics, runs: [], runsCount: 0 },
      selectedPastRuns: [],
      project: null,
      environment: undefined,
      startDate: undefined,
      endDate: undefined,
      bugs: null,
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('retourne un Blob avec des campagnes historiques', async () => {
    const blob = await generateQuickClosureDoc({
      currentMetrics: mockMetrics,
      selectedPastRuns: [
        { version: 'R05', bugsInTest: 2, bugsInProd: 1 },
        { version: 'R04', bugsInTest: 5, bugsInProd: 0 },
      ],
      project: { name: 'Neo-Pilot' },
      environment: 'Prod',
      startDate: '2026-01-01',
      endDate: '2026-04-30',
      bugs: [],
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('gère les métriques nulles / undefined sans planter', async () => {
    const blob = await generateQuickClosureDoc({
      currentMetrics: {},
      selectedPastRuns: undefined,
      project: undefined,
      environment: undefined,
      startDate: undefined,
      endDate: undefined,
      bugs: undefined,
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produit un GO quand tous les critères sont atteints', async () => {
    const goodMetrics = {
      ...mockMetrics,
      completionRate: 95,
      passRate: 85,
      failureRate: 2,
      blockedRate: 1,
    };
    const blob = await generateQuickClosureDoc({
      currentMetrics: goodMetrics,
      selectedPastRuns: [],
      project: { name: 'X' },
      environment: 'Prod',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      bugs: [],
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produit un NO-GO quand un critère est manquant', async () => {
    const badMetrics = {
      ...mockMetrics,
      completionRate: 50,
      passRate: 60,
      failureRate: 30,
      blockedRate: 10,
    };
    const blob = await generateQuickClosureDoc({
      currentMetrics: badMetrics,
      selectedPastRuns: [],
      project: { name: 'X' },
      environment: 'Prod',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      bugs: [{ severity: 'Critique', desc: 'Crash prod' }],
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
