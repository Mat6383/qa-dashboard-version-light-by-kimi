
/**
 * ================================================
 * TESTS — Gardes d'intégrité des composants
 * ================================================
 * Vérifie les fonctions de protection contre :
 *   1. Les accès à slaStatus.alerts sans vérification préalable
 *   2. Les divisions par zéro (milestonesTotal, trends.length)
 *   3. Les accès à metrics.raw / metrics.runs sans null guard
 *   4. La sélection de projet (projectId) dans Dashboard 4
 */

// ─── Logique extraite de Dashboard4.jsx & MetricsCards.jsx ──────────────────

function getAlertForMetric(metrics, metricName) {
  if (!metrics.slaStatus || metrics.slaStatus.ok || !metrics.slaStatus.alerts) return null;
  return metrics.slaStatus.alerts.find(a => a.metric === metricName) || null;
}

// ─── Logique extraite de TvDashboard.jsx ────────────────────────────────────

function milestonePercent(istqb) {
  if (!istqb || !istqb.milestonesTotal) return 0;
  return Math.round((istqb.milestonesCompleted / istqb.milestonesTotal) * 100);
}

// ─── Logique extraite de Dashboard5.jsx ─────────────────────────────────────

function stabiliteVersions(trends) {
  if (!trends || !trends.length) return 0;
  return Math.round((trends.filter(t => t.escapeRate < 5).length / trends.length) * 100);
}

// ─── Null guards pour metrics.raw et metrics.runs ───────────────────────────

function safeRaw(metrics) {
  return metrics.raw || { completed: 0, total: 0, passed: 0, failed: 0, wip: 0, blocked: 0, untested: 0 };
}

function safeRuns(metrics) {
  return metrics.runs || [];
}

// ─── TESTS getAlertForMetric ─────────────────────────────────────────────────

describe('getAlertForMetric — slaStatus.alerts guard', () => {
  test('retourne null si slaStatus est absent', () => {
    expect(getAlertForMetric({}, 'Pass Rate')).toBeNull();
  });

  test('retourne null si slaStatus.ok est true (pas d\'alerte)', () => {
    const metrics = { slaStatus: { ok: true, alerts: [{ metric: 'Pass Rate' }] } };
    expect(getAlertForMetric(metrics, 'Pass Rate')).toBeNull();
  });

  test('retourne null si slaStatus.alerts est absent (pas de crash)', () => {
    const metrics = { slaStatus: { ok: false } };
    expect(getAlertForMetric(metrics, 'Pass Rate')).toBeNull();
  });

  test('retourne null si slaStatus.alerts est null', () => {
    const metrics = { slaStatus: { ok: false, alerts: null } };
    expect(getAlertForMetric(metrics, 'Pass Rate')).toBeNull();
  });

  test('retourne l\'alerte correspondante si elle existe', () => {
    const alert = { metric: 'Pass Rate', severity: 'critical', message: 'Pass rate critique: 60%' };
    const metrics = { slaStatus: { ok: false, alerts: [alert] } };
    expect(getAlertForMetric(metrics, 'Pass Rate')).toEqual(alert);
  });

  test('retourne null si le metricName ne correspond à aucune alerte', () => {
    const metrics = { slaStatus: { ok: false, alerts: [{ metric: 'Completion Rate' }] } };
    expect(getAlertForMetric(metrics, 'Pass Rate')).toBeNull();
  });

  test('ne crash pas quand alerts est un tableau vide', () => {
    const metrics = { slaStatus: { ok: false, alerts: [] } };
    expect(getAlertForMetric(metrics, 'Pass Rate')).toBeNull();
  });
});

// ─── TESTS milestonePercent ──────────────────────────────────────────────────

describe('milestonePercent — division par zéro sur milestonesTotal', () => {
  test('retourne 0 si istqb est absent', () => {
    expect(milestonePercent(undefined)).toBe(0);
  });

  test('retourne 0 si milestonesTotal vaut 0', () => {
    expect(milestonePercent({ milestonesCompleted: 0, milestonesTotal: 0 })).toBe(0);
  });

  test('retourne 0 si milestonesTotal est undefined', () => {
    expect(milestonePercent({ milestonesCompleted: 3 })).toBe(0);
  });

  test('calcule correctement 50% (3/6)', () => {
    expect(milestonePercent({ milestonesCompleted: 3, milestonesTotal: 6 })).toBe(50);
  });

  test('calcule correctement 100% (6/6)', () => {
    expect(milestonePercent({ milestonesCompleted: 6, milestonesTotal: 6 })).toBe(100);
  });

  test('arrondit correctement (1/3 = 33%)', () => {
    expect(milestonePercent({ milestonesCompleted: 1, milestonesTotal: 3 })).toBe(33);
  });
});

// ─── TESTS stabiliteVersions ─────────────────────────────────────────────────

describe('stabiliteVersions — division par zéro sur trends.length', () => {
  test('retourne 0 si trends est un tableau vide', () => {
    expect(stabiliteVersions([])).toBe(0);
  });

  test('retourne 0 si trends est null', () => {
    expect(stabiliteVersions(null)).toBe(0);
  });

  test('retourne 0 si trends est undefined', () => {
    expect(stabiliteVersions(undefined)).toBe(0);
  });

  test('retourne 100% si toutes les versions ont escapeRate < 5', () => {
    const trends = [{ escapeRate: 1 }, { escapeRate: 2 }, { escapeRate: 3 }];
    expect(stabiliteVersions(trends)).toBe(100);
  });

  test('retourne 0% si aucune version n\'a escapeRate < 5', () => {
    const trends = [{ escapeRate: 10 }, { escapeRate: 8 }];
    expect(stabiliteVersions(trends)).toBe(0);
  });

  test('calcule correctement 50% (1 bonne sur 2)', () => {
    const trends = [{ escapeRate: 2 }, { escapeRate: 7 }];
    expect(stabiliteVersions(trends)).toBe(50);
  });

  test('escapeRate === 5 ne compte pas (strict < 5)', () => {
    const trends = [{ escapeRate: 5 }, { escapeRate: 4 }];
    expect(stabiliteVersions(trends)).toBe(50);
  });
});

// ─── TESTS safeRaw / safeRuns ────────────────────────────────────────────────

describe('safeRaw — null guard sur metrics.raw', () => {
  test('retourne metrics.raw si présent', () => {
    const raw = { completed: 10, total: 20, passed: 8, failed: 2, wip: 5, blocked: 3, untested: 2 };
    expect(safeRaw({ raw })).toEqual(raw);
  });

  test('retourne des zéros si metrics.raw est absent', () => {
    const result = safeRaw({});
    expect(result.completed).toBe(0);
    expect(result.total).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
  });

  test('retourne des zéros si metrics.raw est null', () => {
    const result = safeRaw({ raw: null });
    expect(result.completed).toBe(0);
  });
});

describe('safeRuns — null guard sur metrics.runs', () => {
  test('retourne metrics.runs si présent', () => {
    const runs = [{ id: 1, name: 'Run A' }, { id: 2, name: 'Run B' }];
    expect(safeRuns({ runs })).toEqual(runs);
  });

  test('retourne un tableau vide si metrics.runs est absent', () => {
    expect(safeRuns({})).toEqual([]);
  });

  test('retourne un tableau vide si metrics.runs est null', () => {
    expect(safeRuns({ runs: null })).toEqual([]);
  });

  test('le tableau retourné est safe à utiliser avec .slice() et .length', () => {
    const runs = safeRuns({});
    expect(() => runs.slice(0, 8)).not.toThrow();
    expect(runs.length).toBe(0);
  });
});

// ─── TESTS sélecteur de projet Dashboard 4 ──────────────────────────────────

function parseProjectId(value) {
  const id = parseInt(value, 10);
  return isNaN(id) ? null : id;
}

describe('parseProjectId — parsing du sélecteur de projet Dashboard 4', () => {
  test('parse un id numérique valide', () => {
    expect(parseProjectId('1')).toBe(1);
  });

  test('parse le projet 10 (Workshop Web)', () => {
    expect(parseProjectId('10')).toBe(10);
  });

  test('retourne null pour une valeur vide', () => {
    expect(parseProjectId('')).toBeNull();
  });

  test('retourne null pour une chaîne non numérique', () => {
    expect(parseProjectId('abc')).toBeNull();
  });

  test('parse un entier même si la valeur a des espaces via parseInt', () => {
    expect(parseProjectId(' 5 ')).toBe(5);
  });
});
