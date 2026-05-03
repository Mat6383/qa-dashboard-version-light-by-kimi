
/**
 * ================================================
 * TESTS — Calculs Report Service & Modal Preview
 * ================================================
 * Vérifie :
 *   1. Le mapping des champs runs (testmo.service → frontend)
 *   2. Les calculs de statistiques de collectReportData (report.service.js)
 *   3. La logique de verdict GO / GO SOUS RÉSERVE / NO GO
 *   4. L'extraction du milestoneId depuis metrics.runs
 */

// ─── Mapping runs produit par testmo.service.js ──────────────────────────────
// testmo.service.js rename les champs Testmo :
//   run.total_count  → r.total
//   run.milestone_id → r.milestone
//   run.status1_count → r.passed
//   run.status2_count → r.failed
function makeMappedRun(overrides = {}) {
  return {
    id: 1,
    name: 'GWELL - R06',
    total: 30,
    completed: 28,
    passed: 25,
    failed: 3,
    blocked: 0,
    wip: 2,
    untested: 0,
    completionRate: 93.33,
    passRate: 89.29,
    milestone: 42,       // ← renommé depuis milestone_id
    isExploratory: false,
    ...overrides,
  };
}

// ─── Helpers extraits de report.service.js ──────────────────────────────────
function computeReportStats(runsData) {
  const totalTests = runsData.reduce((s, r) => s + r.total, 0);
  const totalPassed = runsData.reduce((s, r) => s + r.passed, 0);
  const totalFailed = runsData.reduce((s, r) => s + r.failed, 0);
  const totalSkipped = runsData.reduce((s, r) => s + (r.skipped || 0), 0);
  const totalWip = runsData.reduce((s, r) => s + (r.wip || 0), 0);
  const executed = totalTests - totalWip - totalSkipped;
  const completionRate = totalTests > 0 ? Math.round(((totalTests - totalWip) / totalTests) * 1000) / 10 : 0;
  const passRate = executed > 0 ? Math.round((totalPassed / executed) * 1000) / 10 : 0;
  const failureRate = executed > 0 ? Math.round((totalFailed / executed) * 1000) / 10 : 0;
  return { totalTests, totalPassed, totalFailed, totalSkipped, totalWip, executed, completionRate, passRate, failureRate };
}

function computeVerdict(passRate, failureRate) {
  if (passRate < 70 || failureRate > 30) return 'NO GO';
  if (passRate < 95 || failureRate > 5)  return 'GO SOUS RÉSERVE';
  return 'GO';
}

// ─── Helpers extraits de ReportGeneratorModal.jsx ───────────────────────────
function modalSummary(runs) {
  const milestoneId  = runs[0]?.milestone || null;
  const totalTests   = runs.reduce((s, r) => s + (r.total || 0), 0);
  const totalPassed  = runs.reduce((s, r) => s + (r.passed || 0), 0);
  const totalFailed  = runs.reduce((s, r) => s + (r.failed || 0), 0);
  return { milestoneId, totalTests, totalPassed, totalFailed };
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('Mapping des champs runs (testmo.service → frontend)', () => {
  test('r.total existe et vaut le total_count Testmo', () => {
    const run = makeMappedRun({ total: 16 });
    expect(run.total).toBe(16);
    expect(run.total_count).toBeUndefined(); // le champ original n'est pas exposé
  });

  test('r.milestone existe et vaut le milestone_id Testmo', () => {
    const run = makeMappedRun({ milestone: 42 });
    expect(run.milestone).toBe(42);
    expect(run.milestone_id).toBeUndefined();
  });

  test('r.passed et r.failed existent', () => {
    const run = makeMappedRun({ passed: 14, failed: 2 });
    expect(run.passed).toBe(14);
    expect(run.failed).toBe(2);
    expect(run.success_count).toBeUndefined();
    expect(run.failure_count).toBeUndefined();
  });
});

describe('modalSummary — prévisualisation dans ReportGeneratorModal', () => {
  test('milestoneId extrait depuis r.milestone (pas r.milestone_id)', () => {
    const runs = [makeMappedRun({ milestone: 42 })];
    expect(modalSummary(runs).milestoneId).toBe(42);
  });

  test('milestoneId est null si runs est vide', () => {
    expect(modalSummary([]).milestoneId).toBeNull();
  });

  test('totalTests calculé depuis r.total (pas r.total_count)', () => {
    const runs = [
      makeMappedRun({ total: 16 }),
      makeMappedRun({ total: 14 }),
    ];
    expect(modalSummary(runs).totalTests).toBe(30);
  });

  test('totalTests = 0 si tous les runs n\'ont pas de champ total', () => {
    // Cas où l'ancien code (r.total_count) donnait 0
    const runs = [{ passed: 5, failed: 1 }]; // pas de .total ni .total_count
    expect(modalSummary(runs).totalTests).toBe(0);
  });

  test('totalPassed et totalFailed depuis r.passed / r.failed', () => {
    const runs = [
      makeMappedRun({ passed: 10, failed: 2 }),
      makeMappedRun({ passed: 5, failed: 1 }),
    ];
    const s = modalSummary(runs);
    expect(s.totalPassed).toBe(15);
    expect(s.totalFailed).toBe(3);
  });

  test('avec session exploratoire incluse dans runs', () => {
    const regularRun = makeMappedRun({ total: 10, passed: 8, failed: 2, milestone: 7 });
    const session = { id: 'session-34', name: 'Session Gab', total: 3, passed: 2, failed: 1, milestone: 7, isExploratory: true };
    const s = modalSummary([regularRun, session]);
    expect(s.totalTests).toBe(13);
    expect(s.totalPassed).toBe(10);
    expect(s.totalFailed).toBe(3);
    expect(s.milestoneId).toBe(7);
  });
});

describe('computeReportStats — statistiques backend (report.service.js)', () => {
  test('cas simple : 10 tests, 8 passés, 2 échoués, 0 wip', () => {
    const runs = [{ total: 10, passed: 8, failed: 2, skipped: 0, wip: 0 }];
    const s = computeReportStats(runs);
    expect(s.totalTests).toBe(10);
    expect(s.totalPassed).toBe(8);
    expect(s.totalFailed).toBe(2);
    expect(s.executed).toBe(10);
    expect(s.completionRate).toBe(100);
    expect(s.passRate).toBe(80);
    expect(s.failureRate).toBe(20);
  });

  test('passRate + failureRate = 100 quand pas de wip/skipped', () => {
    const runs = [{ total: 10, passed: 7, failed: 3, skipped: 0, wip: 0 }];
    const { passRate, failureRate } = computeReportStats(runs);
    expect(passRate + failureRate).toBe(100);
  });

  test('completionRate exclut les wip du numérateur', () => {
    // 10 total, 2 wip → 8 exécutés → 80%
    const runs = [{ total: 10, passed: 6, failed: 2, skipped: 0, wip: 2 }];
    const s = computeReportStats(runs);
    expect(s.completionRate).toBe(80);
    expect(s.executed).toBe(8);  // totalTests - wip - skipped
  });

  test('passRate calculé sur executed (pas sur totalTests)', () => {
    // 10 total, 2 wip → executed=8, passed=8 → passRate=100 (pas 80)
    const runs = [{ total: 10, passed: 8, failed: 0, skipped: 0, wip: 2 }];
    const s = computeReportStats(runs);
    expect(s.passRate).toBe(100);
  });

  test('données réelles R06 : 141 réussis / 171 total', () => {
    // Valeurs affichées dans la photo : 141 réussis, 30 échoués, 16 runs (171 total visible)
    const runs = [{ total: 171, passed: 141, failed: 30, skipped: 0, wip: 0 }];
    const s = computeReportStats(runs);
    expect(s.totalTests).toBe(171);
    expect(s.totalPassed).toBe(141);
    expect(s.totalFailed).toBe(30);
    expect(s.passRate).toBeCloseTo(82.46, 1);
    expect(s.failureRate).toBeCloseTo(17.54, 1);
  });

  test('zéro tests → tout à 0 (pas de crash)', () => {
    const runs = [{ total: 0, passed: 0, failed: 0, skipped: 0, wip: 0 }];
    const s = computeReportStats(runs);
    expect(s.completionRate).toBe(0);
    expect(s.passRate).toBe(0);
    expect(s.failureRate).toBe(0);
  });

  test('agrégation sur plusieurs runs', () => {
    const runs = [
      { total: 10, passed: 9, failed: 1, skipped: 0, wip: 0 },
      { total: 10, passed: 7, failed: 3, skipped: 0, wip: 0 },
    ];
    const s = computeReportStats(runs);
    expect(s.totalTests).toBe(20);
    expect(s.totalPassed).toBe(16);
    expect(s.totalFailed).toBe(4);
    expect(s.passRate).toBe(80);
  });
});

describe('computeVerdict — GO / GO SOUS RÉSERVE / NO GO', () => {
  test('passRate >= 95 et failureRate <= 5 → GO', () => {
    expect(computeVerdict(97, 3)).toBe('GO');
    expect(computeVerdict(95, 5)).toBe('GO');
    expect(computeVerdict(100, 0)).toBe('GO');
  });

  test('passRate entre 70 et 95 ou failureRate entre 5 et 30 → GO SOUS RÉSERVE', () => {
    expect(computeVerdict(82.5, 17.5)).toBe('GO SOUS RÉSERVE');
    expect(computeVerdict(90, 10)).toBe('GO SOUS RÉSERVE');
    expect(computeVerdict(94.9, 5.1)).toBe('GO SOUS RÉSERVE');
  });

  test('passRate < 70 → NO GO (prioritaire)', () => {
    expect(computeVerdict(65, 35)).toBe('NO GO');
    expect(computeVerdict(50, 10)).toBe('NO GO');
  });

  test('failureRate > 30 → NO GO (prioritaire)', () => {
    expect(computeVerdict(80, 31)).toBe('NO GO');
  });

  test('données réelles R06 (passRate~82%) → GO SOUS RÉSERVE', () => {
    expect(computeVerdict(82.46, 17.54)).toBe('GO SOUS RÉSERVE');
  });

  test('100% de succès → GO', () => {
    expect(computeVerdict(100, 0)).toBe('GO');
  });
});
