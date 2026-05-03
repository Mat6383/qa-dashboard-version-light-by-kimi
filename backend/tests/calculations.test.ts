import { STATUS_TO_LABEL, STATUS_TO_GITLAB_STATUS, GITLAB_STATUS_OK, GITLAB_STATUS_KO, GITLAB_STATUS_WIP, GITLAB_STATUS_RETEST, GITLAB_STATUS_TODO, computeStatusChange, VERSION_FIELD_KEY } from '../services/status-sync.service';
/**
 * ================================================
 * TESTS DE VÉRIFICATION DES CALCULS ISTQB
 * ================================================
 * Vérifie la cohérence des formules utilisées dans testmo.service.js
 *
 * Données réelles de référence (sprint en cours) :
 *   - Session Gab   : success=2, failure=1  → passRate = 66.67%
 *   - Session Pauline : success=1, failure=0 → passRate = 100%
 *   - Session Sophie : success=0, failure=3  → passRate = 0%
 */

// ─── Helpers extraits de testmo.service.js (sans dépendances) ───────────────


function _calculatePercentage(value, total) {
  if (!total || total === 0) return 0;
  return parseFloat(((value / total) * 100).toFixed(2));
}

function sessionPassRate(session) {
  const successCount = session.success_count || 0;
  const failureCount = session.failure_count || 0;
  return _calculatePercentage(successCount, successCount + failureCount);
}

function aggregateSessions(sessions) {
  const aggregated = {
    total: 0, passed: 0, failed: 0,
    completed: 0, success: 0, failure: 0, wip: 0,
  };

  sessions.forEach(session => {
    const successCount = session.success_count || 0;
    const failureCount = session.failure_count || 0;
    const sessionTotal = successCount + failureCount;

    if (sessionTotal > 0) {
      aggregated.total     += sessionTotal;
      aggregated.passed    += successCount;
      aggregated.failed    += failureCount;
      aggregated.completed += sessionTotal;
      aggregated.success   += successCount;
      aggregated.failure   += failureCount;
    } else {
      aggregated.total += 1;
      aggregated.wip   += 1;
    }
  });

  return aggregated;
}

function globalMetrics(aggregated) {
  return {
    completionRate:  _calculatePercentage(aggregated.completed, aggregated.total),
    passRate:        _calculatePercentage(aggregated.passed, aggregated.completed),
    failureRate:     _calculatePercentage(aggregated.failed, aggregated.completed),
    testEfficiency:  _calculatePercentage(aggregated.passed, aggregated.passed + aggregated.failed),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('_calculatePercentage', () => {
  test('retourne 0 quand total vaut 0', () => {
    expect(_calculatePercentage(5, 0)).toBe(0);
  });

  test('retourne 0 quand total est null', () => {
    expect(_calculatePercentage(5, null)).toBe(0);
  });

  test('retourne 0 quand total est undefined', () => {
    expect(_calculatePercentage(5, undefined)).toBe(0);
  });

  test('calcule 100% quand value === total', () => {
    expect(_calculatePercentage(5, 5)).toBe(100);
  });

  test('calcule 50% correctement', () => {
    expect(_calculatePercentage(1, 2)).toBe(50);
  });

  test('arrondit à 2 décimales', () => {
    // 2/3 = 66.666... → 66.67
    expect(_calculatePercentage(2, 3)).toBe(66.67);
  });

  test('retourne 0 quand value vaut 0', () => {
    expect(_calculatePercentage(0, 10)).toBe(0);
  });
});

describe('sessionPassRate — calcul basé sur success_count / failure_count', () => {
  test('Session Gab : 2 passed, 1 failed → 66.67%', () => {
    const session = { success_count: 2, failure_count: 1 };
    expect(sessionPassRate(session)).toBe(66.67);
  });

  test('Session Pauline : 1 passed, 0 failed → 100%', () => {
    const session = { success_count: 1, failure_count: 0 };
    expect(sessionPassRate(session)).toBe(100);
  });

  test('Session Sophie : 0 passed, 3 failed → 0%', () => {
    const session = { success_count: 0, failure_count: 3 };
    expect(sessionPassRate(session)).toBe(0);
  });

  test('Session sans aucun résultat → 0% (pas de division par zéro)', () => {
    const session = { success_count: 0, failure_count: 0 };
    expect(sessionPassRate(session)).toBe(0);
  });

  test('Session avec champs manquants → 0%', () => {
    expect(sessionPassRate({})).toBe(0);
  });

  test('Retest : 3 passed cumulés, 1 failed → 75%', () => {
    // Un test repassé en passed après un failed : 3 passed (logs), 1 failed (log)
    const session = { success_count: 3, failure_count: 1 };
    expect(sessionPassRate(session)).toBe(75);
  });
});

describe('aggregateSessions — intégration des sessions dans les métriques globales', () => {
  test('une session avec résultats contribue au total et aux compteurs', () => {
    const sessions = [{ success_count: 2, failure_count: 1 }];
    const agg = aggregateSessions(sessions);
    expect(agg.total).toBe(3);
    expect(agg.passed).toBe(2);
    expect(agg.failed).toBe(1);
    expect(agg.completed).toBe(3);
    expect(agg.wip).toBe(0);
  });

  test('une session sans résultat est comptée comme 1 WIP', () => {
    const sessions = [{ success_count: 0, failure_count: 0 }];
    const agg = aggregateSessions(sessions);
    expect(agg.total).toBe(1);
    expect(agg.wip).toBe(1);
    expect(agg.passed).toBe(0);
    expect(agg.failed).toBe(0);
    expect(agg.completed).toBe(0);
  });

  test('plusieurs sessions (Gab + Pauline + Sophie) agrégées correctement', () => {
    const sessions = [
      { success_count: 2, failure_count: 1 }, // Gab
      { success_count: 1, failure_count: 0 }, // Pauline
      { success_count: 0, failure_count: 3 }, // Sophie
    ];
    const agg = aggregateSessions(sessions);
    expect(agg.total).toBe(7);     // 3 + 1 + 3
    expect(agg.passed).toBe(3);    // 2 + 1 + 0
    expect(agg.failed).toBe(4);    // 1 + 0 + 3
    expect(agg.completed).toBe(7);
    expect(agg.wip).toBe(0);
  });

  test('mix session avec résultats et session WIP', () => {
    const sessions = [
      { success_count: 5, failure_count: 0 },
      { success_count: 0, failure_count: 0 }, // WIP
    ];
    const agg = aggregateSessions(sessions);
    expect(agg.total).toBe(6);     // 5 + 1 WIP
    expect(agg.passed).toBe(5);
    expect(agg.wip).toBe(1);
    expect(agg.completed).toBe(5); // La session WIP n'est pas completed
  });

  test('liste de sessions vide → agrégat à zéro', () => {
    const agg = aggregateSessions([]);
    expect(agg.total).toBe(0);
    expect(agg.passed).toBe(0);
    expect(agg.failed).toBe(0);
    expect(agg.wip).toBe(0);
  });
});

// ─── Helper extrait de sync.service.js — _extractStepsFromNotes ─────────────
// marked est ESM-only, on utilise un stub simple pour les tests unitaires
function fakeMarked(text) { return `<p>${text.trim()}</p>`; }

function extractStepsFromNotes(notes, markedFn = fakeMarked) {
  // (?!\() exclut les liens markdown [texte](url)
  const SECTION_HEADER_RE = /\[([^\]]+)\](?!\()/g;
  const TEST_RE = /^tests?$/i;

  const structured = notes.filter(n => n.body && /\[[^\]]+\](?!\()/.test(n.body));
  if (structured.length === 0) return [];

  // Extrait les sections { label, content } d'un body
  function parseSections(body) {
    const headers = [];
    let m;
    const re = new RegExp(SECTION_HEADER_RE.source, 'g');
    while ((m = re.exec(body)) !== null) {
      headers.push({ label: m[1].trim(), start: m.index, end: m.index + m[0].length });
    }
    return headers.map((h, i) => {
      const contentEnd = i + 1 < headers.length ? headers[i + 1].start : body.length;
      return { label: h.label, content: body.slice(h.end, contentEnd).trim() };
    }).filter(s => s.content.length > 0);
  }

  // Sections non-TEST : depuis le commentaire le plus complet (le plus long)
  const best = structured.reduce((a, b) => b.body.length > a.body.length ? b : a);
  const otherSections = parseSections(best.body).filter(s => !TEST_RE.test(s.label));

  // Sections [TEST]/[TESTS] : toutes les notes dans l'ordre chronologique (structured = ordre d'arrivée)
  const allTestSections = structured.flatMap(note =>
    parseSections(note.body).filter(s => TEST_RE.test(s.label))
  );

  if (otherSections.length === 0 && allTestSections.length === 0) return [];

  const EXPECTED = '<p>Conforme aux specs fonctionnelles</p>';

  return [...otherSections, ...allTestSections].map((s, i) => ({
    text1: markedFn(`**[${s.label}]**\n\n${s.content}`),
    text3: EXPECTED,
    display_order: i + 1
  }));
}

describe('extractStepsFromNotes — parsing commentaires GitLab → steps Testmo', () => {
  test('commentaire sans section → []', () => {
    const notes = [{ body: 'Simple commentaire sans balise.' }];
    expect(extractStepsFromNotes(notes)).toEqual([]);
  });

  test('notes vides → []', () => {
    expect(extractStepsFromNotes([])).toEqual([]);
  });

  test('commentaire avec [PRÉREQUIS] et [TEST] → TEST toujours en dernier', () => {
    const body = '[PRÉREQUIS]\nAvoir un compte.\n[TEST]\nFaire le test.';
    const steps = extractStepsFromNotes([{ body }]);
    expect(steps).toHaveLength(2);
    expect(steps[0].text1).toContain('[PRÉREQUIS]');
    expect(steps[1].text1).toContain('[TEST]');
    expect(steps[0].display_order).toBe(1);
    expect(steps[1].display_order).toBe(2);
  });

  test('TEST placé en dernier même s\'il est premier dans le commentaire', () => {
    const body = '[TEST]\nEtapes.\n[IMPACT]\nScript R14.';
    const steps = extractStepsFromNotes([{ body }]);
    expect(steps).toHaveLength(2);
    expect(steps[0].text1).toContain('[IMPACT]');
    expect(steps[1].text1).toContain('[TEST]');
  });

  test('[TESTS] (pluriel) aussi mis en dernier', () => {
    const body = '[PRÉREQUIS]\nPré.\n[TESTS]\nTest pluriel.';
    const steps = extractStepsFromNotes([{ body }]);
    expect(steps[steps.length - 1].text1).toContain('[TESTS]');
  });

  test('expected = "Conforme aux specs fonctionnelles" pour tous les steps', () => {
    const body = '[PRÉREQUIS]\nPré.\n[TEST]\nTest.';
    const steps = extractStepsFromNotes([{ body }]);
    steps.forEach(s => expect(s.text3).toBe('<p>Conforme aux specs fonctionnelles</p>'));
  });

  test('champs text1 non vide (format Testmo correct)', () => {
    const body = '[PRÉREQUIS]\nAvoir un client.\n[TEST]\nFaire la manip.';
    const steps = extractStepsFromNotes([{ body }]);
    steps.forEach(s => {
      expect(s.text1).toBeTruthy();
      expect(s.text1.trim().length).toBeGreaterThan(0);
      expect(s).toHaveProperty('text3');
      expect(s).toHaveProperty('display_order');
    });
  });

  test('prend le commentaire le plus long pour les sections non-TEST, collecte tous les [TEST]', () => {
    const notes = [
      { body: '[TEST]\nCourt.' },
      { body: '[PRÉREQUIS]\nLong prérequis avec beaucoup de texte.\n[TEST]\nTest long avec beaucoup d\'étapes.' }
    ];
    const steps = extractStepsFromNotes(notes);
    // [PRÉREQUIS] du plus long + [TEST Court] (note 1, chronologiquement 1ère) + [TEST Long] (note 2)
    expect(steps).toHaveLength(3);
    expect(steps[0].text1).toContain('[PRÉREQUIS]');
    expect(steps[1].text1).toContain('Court');
    expect(steps[2].text1).toContain('Test long');
  });

  test('lien markdown [R14.sql](url) dans le contenu ne crée pas de faux step', () => {
    // Cas réel #5777 : [TEST] contient [R14.sql](https://...) qui ne doit pas être traité comme section
    const body = `[TEST]
Passer le script [R14.sql](https://gitlab.neo-logix.fr/blob/master/SQL/R14.sql)

> Atelier > OF
Ouvrir un OF qui est état lancé

[IMPACT]
FEN_OF
FEN_PLANNING_DAY`;
    const steps = extractStepsFromNotes([{ body }]);
    // Doit produire 2 steps (TEST + IMPACT), pas 3 avec [R14.sql] comme section
    expect(steps).toHaveLength(2);
    // Le contenu du TEST doit inclure le lien
    const testStep = steps.find(s => s.text1.includes('[TEST]'));
    expect(testStep).toBeDefined();
    expect(testStep.text1).toContain('R14.sql');
    // TEST doit être en dernier
    expect(steps[steps.length - 1].text1).toContain('[TEST]');
  });

  test('commentaire réel R14 (PRÉREQUIS + TEST + IMPACT) → 3 steps, TEST en dernier', () => {
    const body = `[PRÉREQUIS]
Tester avant de passer le script R14.
Avoir un client avec compte-poids.
[TEST]
Pour générer des mouvement de compte-poids prévisionnels :
Trouver un client sur compte-poids.
Vente → Commande → Nouvelle commande sur ce client.
[IMPACT]
Script R14.`;
    const steps = extractStepsFromNotes([{ body }]);
    expect(steps).toHaveLength(3);
    expect(steps[0].text1).toContain('[PRÉREQUIS]');
    expect(steps[1].text1).toContain('[IMPACT]');
    expect(steps[2].text1).toContain('[TEST]');
  });

  // ─── Nouveau comportement : collecte de TOUS les [TEST] chronologiquement ─────

  test('deux notes avec [TEST] → les deux steps TEST collectés dans l\'ordre chronologique', () => {
    const notes = [
      { body: '[PRÉREQUIS]\nPré requis ici.\n[TEST]\nTest de la note 1.' },
      { body: '[TEST]\nTest de la note 2.' }
    ];
    // plus complet = note 1 → non-TEST : [PRÉREQUIS]
    // tous les [TEST] chrono : note1 puis note2
    const steps = extractStepsFromNotes(notes);
    expect(steps).toHaveLength(3);
    expect(steps[0].text1).toContain('[PRÉREQUIS]');
    expect(steps[1].text1).toContain('Test de la note 1');
    expect(steps[2].text1).toContain('Test de la note 2');
  });

  test('[TEST] dans une note plus ancienne que le plus complet → aussi inclus (option A)', () => {
    const notes = [
      { body: '[TEST]\nPremier test (ancien).' },
      { body: '[PRÉREQUIS]\nPré.\n[IMPACT]\nImpact.\n[TEST]\nTest complet.' }
    ];
    // plus complet = note 2 → non-TEST : [PRÉREQUIS] + [IMPACT]
    // tous les [TEST] chrono : note1 (ancien) puis note2
    const steps = extractStepsFromNotes(notes);
    expect(steps).toHaveLength(4);
    expect(steps[0].text1).toContain('[PRÉREQUIS]');
    expect(steps[1].text1).toContain('[IMPACT]');
    expect(steps[2].text1).toContain('Premier test');
    expect(steps[3].text1).toContain('Test complet');
  });

  test('trois notes avec [TEST] → 3 steps TEST dans l\'ordre chronologique', () => {
    const notes = [
      { body: '[TEST]\nTest A.' },
      { body: '[TEST]\nTest B.' },
      { body: '[TEST]\nTest C.' }
    ];
    const steps = extractStepsFromNotes(notes);
    expect(steps).toHaveLength(3);
    expect(steps[0].text1).toContain('Test A');
    expect(steps[1].text1).toContain('Test B');
    expect(steps[2].text1).toContain('Test C');
  });

  test('note sans [TEST] + note avec [TEST] seul → [TEST] de la 2e note inclus', () => {
    const notes = [
      { body: '[PRÉREQUIS]\nPré.\n[IMPACT]\nImpact.' },
      { body: '[TEST]\nTest récent.' }
    ];
    const steps = extractStepsFromNotes(notes);
    expect(steps).toHaveLength(3);
    expect(steps[0].text1).toContain('[PRÉREQUIS]');
    expect(steps[1].text1).toContain('[IMPACT]');
    expect(steps[2].text1).toContain('Test récent');
  });

  test('[TESTS] pluriel dans une note secondaire → aussi collecté', () => {
    const notes = [
      { body: '[PRÉREQUIS]\nPré.\n[TEST]\nTest principal.' },
      { body: '[TESTS]\nCorrection de test.' }
    ];
    const steps = extractStepsFromNotes(notes);
    expect(steps).toHaveLength(3);
    expect(steps[0].text1).toContain('[PRÉREQUIS]');
    expect(steps[1].text1).toContain('Test principal');
    expect(steps[2].text1).toContain('Correction de test');
  });
});

// ─── Helper extrait de testmo.service.js — isCaseEnriched ────────────────────
function isCaseEnriched(testCase) {
  if (testCase.estimate && testCase.estimate > 0) return true;
  if (testCase.issues && testCase.issues.length > 0) return true;

  const manualTags = (testCase.tags || []).filter(t => {
    const name = typeof t === 'string' ? t : (t.name || t.tag || '');
    if (!name) return false;
    return !name.startsWith('gitlab-') && !name.startsWith('iteration-') && name !== 'sync-auto';
  });
  if (manualTags.length > 0) return true;

  if (testCase.custom_priority && testCase.custom_priority !== 'Normal' && testCase.custom_priority !== 2) return true;
  if (testCase.attachments && testCase.attachments.length > 0) return true;
  // Format Testmo réel: text1 = contenu du step
  const nonEmptySteps = (testCase.custom_steps || []).filter(s => {
    const content = typeof s === 'object' ? (s.text1 || s.step || s.content || '') : String(s || '');
    return content.trim().length > 0;
  });
  if (nonEmptySteps.length > 0) return true;

  return false;
}

describe('isCaseEnriched — protection anti-écrasement des cas enrichis', () => {
  // ── Cas NON enrichis (sync peut écraser) ──
  test('case vide (auto-créé, pas de data) → false', () => {
    expect(isCaseEnriched({})).toBe(false);
  });

  test('only auto-tags (sync-auto, gitlab-, iteration-) → false', () => {
    const c = { tags: ['sync-auto', 'gitlab-6015', 'iteration-r14-run-1'] };
    expect(isCaseEnriched(c)).toBe(false);
  });

  test('tags sous forme objet { name } uniquement auto → false', () => {
    const c = { tags: [{ name: 'sync-auto' }, { name: 'gitlab-6015' }] };
    expect(isCaseEnriched(c)).toBe(false);
  });

  // ── Cas ENRICHIS (sync doit skiper) ──
  test('a des custom_steps avec text1 (format Testmo réel) → true', () => {
    const c = { custom_steps: [{ text1: '<p>Ouvrir la page</p>', text3: '<p>Page affichée</p>', display_order: 1 }] };
    expect(isCaseEnriched(c)).toBe(true);
  });

  test('custom_steps avec text1 vide (steps vides créés par erreur) → false', () => {
    const c = { custom_steps: [{ text1: '', text3: null, display_order: 1 }] };
    expect(isCaseEnriched(c)).toBe(false);
  });

  test('custom_steps avec text1 whitespace seulement → false', () => {
    const c = { custom_steps: [{ text1: '   ', text3: null, display_order: 1 }] };
    expect(isCaseEnriched(c)).toBe(false);
  });

  test('a un estimate → true', () => {
    expect(isCaseEnriched({ estimate: 900 })).toBe(true);
  });

  test('a des issues liées → true', () => {
    expect(isCaseEnriched({ issues: [{ id: 1 }] })).toBe(true);
  });

  test('a un tag manuel (ni gitlab-, ni iteration-, ni sync-auto) → true', () => {
    const c = { tags: ['sync-auto', 'regression'] };
    expect(isCaseEnriched(c)).toBe(true);
  });

  test('priorité custom ≠ Normal → true', () => {
    expect(isCaseEnriched({ custom_priority: 'High' })).toBe(true);
  });

  test('a des attachments → true', () => {
    expect(isCaseEnriched({ attachments: [{ id: 1 }] })).toBe(true);
  });

  // ── Régression : tags malformés (bug #6015) ──
  test('tag objet avec champ .tag (pas .name) → ne crash pas, auto-tag ignoré', () => {
    // Cas qui provoquait "Cannot read properties of undefined (reading 'startsWith')"
    const c = { tags: [{ id: 5, tag: 'sync-auto' }, { id: 6, tag: 'gitlab-6015' }] };
    expect(() => isCaseEnriched(c)).not.toThrow();
    expect(isCaseEnriched(c)).toBe(false); // ce sont des auto-tags
  });

  test('tag objet avec champ .tag manuel → true', () => {
    const c = { tags: [{ id: 5, tag: 'sync-auto' }, { id: 7, tag: 'smoke' }] };
    expect(isCaseEnriched(c)).toBe(true);
  });

  test('tag objet sans .name ni .tag (objet incomplet) → ne crash pas', () => {
    const c = { tags: [{ id: 5 }, { id: 6 }] };
    expect(() => isCaseEnriched(c)).not.toThrow();
    expect(isCaseEnriched(c)).toBe(false);
  });

  test('tags null/undefined → ne crash pas → false', () => {
    expect(isCaseEnriched({ tags: null })).toBe(false);
    expect(isCaseEnriched({ tags: undefined })).toBe(false);
  });
});

describe('globalMetrics — formules ISTQB', () => {
  test('completionRate = completed / total', () => {
    const agg = { total: 10, completed: 8, passed: 6, failed: 2 };
    expect(globalMetrics(agg).completionRate).toBe(80);
  });

  test('passRate = passed / completed (pas sur total)', () => {
    // 6 passed sur 8 exécutés (2 non-exécutés) → 75%, pas 60%
    const agg = { total: 10, completed: 8, passed: 6, failed: 2 };
    expect(globalMetrics(agg).passRate).toBe(75);
  });

  test('failureRate = failed / completed', () => {
    const agg = { total: 10, completed: 8, passed: 6, failed: 2 };
    expect(globalMetrics(agg).failureRate).toBe(25);
  });

  test('passRate + failureRate = 100% quand tout est passé ou échoué', () => {
    const agg = { total: 10, completed: 10, passed: 7, failed: 3 };
    const m = globalMetrics(agg);
    expect(m.passRate + m.failureRate).toBe(100);
  });

  test('testEfficiency = passed / (passed + failed)', () => {
    // Exclut les non-décisifs (blocked, skipped) — mesure la qualité des exécutions
    const agg = { total: 10, completed: 10, passed: 8, failed: 2 };
    expect(globalMetrics(agg).testEfficiency).toBe(80);
  });

  test('testEfficiency résiste à 0 passed et 0 failed', () => {
    const agg = { total: 5, completed: 0, passed: 0, failed: 0 };
    expect(globalMetrics(agg).testEfficiency).toBe(0);
  });

  test('cas réel : Gab + Pauline + Sophie agrégées', () => {
    // total=7, passed=3, failed=4, completed=7
    const sessions = [
      { success_count: 2, failure_count: 1 },
      { success_count: 1, failure_count: 0 },
      { success_count: 0, failure_count: 3 },
    ];
    const agg = aggregateSessions(sessions);
    const m = globalMetrics(agg);

    expect(m.completionRate).toBe(100);           // 7/7
    expect(m.passRate).toBe(42.86);               // 3/7
    expect(m.failureRate).toBe(57.14);            // 4/7
    expect(m.testEfficiency).toBe(42.86);         // 3/(3+4)
  });

  test('toutes sessions passées → passRate 100%, failureRate 0%', () => {
    const agg = { total: 5, completed: 5, passed: 5, failed: 0 };
    const m = globalMetrics(agg);
    expect(m.passRate).toBe(100);
    expect(m.failureRate).toBe(0);
    expect(m.testEfficiency).toBe(100);
  });

  test('zéro tests → toutes les métriques à 0 (pas de crash)', () => {
    const agg = { total: 0, completed: 0, passed: 0, failed: 0 };
    const m = globalMetrics(agg);
    expect(m.completionRate).toBe(0);
    expect(m.passRate).toBe(0);
    expect(m.failureRate).toBe(0);
    expect(m.testEfficiency).toBe(0);
  });
});

// ─── Helpers extraits de status-sync.service.js ──────────────────────────────

// Noms lisibles des statuts Testmo (pour les commentaires GitLab)
const STATUS_ID_TO_NAME = {
  2: 'Passed',
  3: 'Failed',
  4: 'Retest',
  8: 'WIP'
};

const ALL_TEST_LABELS = [
  'Test::OK',
  'Test::KO',
  'Test::WIP',
  'Test::SKIPPED',
  'Test::BLOCKED',
  'DoubleTestNécessaire',
  'Test::TODO'
];

/**
 * Calcule les changements de labels à appliquer à une issue.
 * Extrait de StatusSyncService.syncRunStatusToGitLab()
 */
function computeLabelChanges(currentLabels, newLabel) {
  if (!newLabel) return { addLabel: null, removeLabels: [], action: 'skip' };

  const labelsToRemove = currentLabels.filter(l => ALL_TEST_LABELS.includes(l) && l !== newLabel);
  const alreadyHasLabel = currentLabels.includes(newLabel);

  if (alreadyHasLabel && labelsToRemove.length === 0) {
    return { addLabel: newLabel, removeLabels: [], action: 'noop' };
  }
  return { addLabel: newLabel, removeLabels: labelsToRemove, action: 'update' };
}

/**
 * Formate le texte du commentaire automatique (extrait de StatusSyncService._buildCommentText)
 */
function buildCommentText(runName, statusId) {
  const statusName = STATUS_ID_TO_NAME[statusId] || String(statusId);
  return `Commentaire ajouté automatiquement - Test sur le run: ${runName} - Status ${statusName}`;
}

/**
 * Vérifie si un commentaire identique existe déjà (extrait de _postCommentIfNeeded)
 */
function isCommentDuplicate(existingNotes, commentText) {
  return existingNotes.some(n => n.body === commentText);
}

describe('ALL_TEST_LABELS — liste exhaustive des labels Test:: gérés', () => {
  test('contient tous les labels attendus', () => {
    expect(ALL_TEST_LABELS).toContain('Test::OK');
    expect(ALL_TEST_LABELS).toContain('Test::KO');
    expect(ALL_TEST_LABELS).toContain('Test::WIP');
    expect(ALL_TEST_LABELS).toContain('Test::SKIPPED');
    expect(ALL_TEST_LABELS).toContain('Test::BLOCKED');
    expect(ALL_TEST_LABELS).toContain('DoubleTestNécessaire');
    expect(ALL_TEST_LABELS).toContain('Test::TODO');
  });
});

describe('STATUS_ID_TO_NAME — noms lisibles des statuts Testmo', () => {
  test('2 → "Passed"', () => {
    expect(STATUS_ID_TO_NAME[2]).toBe('Passed');
  });

  test('3 → "Failed"', () => {
    expect(STATUS_ID_TO_NAME[3]).toBe('Failed');
  });

  test('4 → "Retest"', () => {
    expect(STATUS_ID_TO_NAME[4]).toBe('Retest');
  });

  test('8 → "WIP"', () => {
    expect(STATUS_ID_TO_NAME[8]).toBe('WIP');
  });

  test('statut inconnu → undefined', () => {
    expect(STATUS_ID_TO_NAME[99]).toBeUndefined();
  });

  test('tous les statuts de STATUS_TO_LABEL ont un nom lisible', () => {
    Object.keys(STATUS_TO_LABEL).forEach(id => {
      expect(STATUS_ID_TO_NAME[Number(id)]).toBeTruthy();
    });
  });
});

describe('buildCommentText — format du commentaire automatique GitLab', () => {
  test('format correct pour un run et un statut Passed', () => {
    const text = buildCommentText('R10 - run 1', 2);
    expect(text).toBe('Commentaire ajouté automatiquement - Test sur le run: R10 - run 1 - Status Passed');
  });

  test('format correct pour un statut WIP', () => {
    const text = buildCommentText('R14 - run 2', 8);
    expect(text).toBe('Commentaire ajouté automatiquement - Test sur le run: R14 - run 2 - Status WIP');
  });

  test('format correct pour un statut Failed', () => {
    const text = buildCommentText('R10 - run 1', 3);
    expect(text).toBe('Commentaire ajouté automatiquement - Test sur le run: R10 - run 1 - Status Failed');
  });

  test('format correct pour un statut Retest', () => {
    const text = buildCommentText('R10 - run 1', 4);
    expect(text).toBe('Commentaire ajouté automatiquement - Test sur le run: R10 - run 1 - Status Retest');
  });

  test('statut inconnu → affiche l\'id brut comme fallback', () => {
    const text = buildCommentText('R10 - run 1', 99);
    expect(text).toBe('Commentaire ajouté automatiquement - Test sur le run: R10 - run 1 - Status 99');
  });

  test('deux runs différents → deux textes distincts', () => {
    const textA = buildCommentText('R10 - run 1', 2);
    const textB = buildCommentText('R11 - run 1', 2);
    expect(textA).not.toBe(textB);
  });

  test('même run, deux statuts différents → deux textes distincts', () => {
    const textWIP    = buildCommentText('R10 - run 1', 8);
    const textPassed = buildCommentText('R10 - run 1', 2);
    expect(textWIP).not.toBe(textPassed);
  });
});

describe('isCommentDuplicate — idempotence des commentaires GitLab', () => {
  const runName  = 'R10 - run 1';
  const statusId = 2; // Passed
  const commentText = buildCommentText(runName, statusId);

  test('liste vide → pas de doublon', () => {
    expect(isCommentDuplicate([], commentText)).toBe(false);
  });

  test('commentaire identique existe → doublon détecté', () => {
    const notes = [{ body: commentText }];
    expect(isCommentDuplicate(notes, commentText)).toBe(true);
  });

  test('commentaire différent → pas de doublon', () => {
    const notes = [{ body: 'Un autre commentaire' }];
    expect(isCommentDuplicate(notes, commentText)).toBe(false);
  });

  test('plusieurs notes, une seule identique → doublon détecté', () => {
    const notes = [
      { body: 'Commentaire manuel du testeur' },
      { body: commentText },
      { body: 'Autre note auto' }
    ];
    expect(isCommentDuplicate(notes, commentText)).toBe(true);
  });

  test('même run WIP + Passed = deux commentaires distincts (pas de faux doublon)', () => {
    const wipText    = buildCommentText(runName, 8);
    const passedText = buildCommentText(runName, 2);
    // On a uniquement le commentaire WIP dans les notes
    const notes = [{ body: wipText }];
    // Vérifier Passed → pas de doublon (c'est un nouveau statut)
    expect(isCommentDuplicate(notes, passedText)).toBe(false);
    // Vérifier WIP → doublon (déjà posté)
    expect(isCommentDuplicate(notes, wipText)).toBe(true);
  });

  test('note avec body null/undefined → ne crash pas', () => {
    const notes = [{ body: null }, { body: undefined }, { body: commentText }];
    expect(() => isCommentDuplicate(notes, commentText)).not.toThrow();
    expect(isCommentDuplicate(notes, commentText)).toBe(true);
  });
});

describe('computeLabelChanges — logique de mise à jour des labels GitLab', () => {
  // ── Issue sans aucun label Test:: ──────────────────────────────────────────
  test('issue sans label + Passed → ajoute Test::OK, rien à retirer', () => {
    const { addLabel, removeLabels, action } = computeLabelChanges([], 'Test::OK');
    expect(addLabel).toBe('Test::OK');
    expect(removeLabels).toEqual([]);
    expect(action).toBe('update');
  });

  test('issue sans label + WIP → ajoute Test::WIP', () => {
    const { addLabel, removeLabels } = computeLabelChanges([], 'Test::WIP');
    expect(addLabel).toBe('Test::WIP');
    expect(removeLabels).toEqual([]);
  });

  // ── Issue avec un label Test:: existant ───────────────────────────────────
  test('issue Test::KO → Passed : retire Test::KO, ajoute Test::OK', () => {
    const { addLabel, removeLabels, action } = computeLabelChanges(['Test::KO'], 'Test::OK');
    expect(addLabel).toBe('Test::OK');
    expect(removeLabels).toEqual(['Test::KO']);
    expect(action).toBe('update');
  });

  test('issue Test::TODO → WIP : retire Test::TODO, ajoute Test::WIP', () => {
    const { addLabel, removeLabels } = computeLabelChanges(['Test::TODO'], 'Test::WIP');
    expect(addLabel).toBe('Test::WIP');
    expect(removeLabels).toEqual(['Test::TODO']);
  });

  test('issue DoubleTestNécessaire → KO : retire DoubleTestNécessaire, ajoute Test::KO', () => {
    const { addLabel, removeLabels } = computeLabelChanges(['DoubleTestNécessaire'], 'Test::KO');
    expect(addLabel).toBe('Test::KO');
    expect(removeLabels).toEqual(['DoubleTestNécessaire']);
  });

  // ── Label déjà correct (idempotent) ───────────────────────────────────────
  test('issue déjà Test::OK → Passed : action=noop, rien à retirer', () => {
    const { action, removeLabels } = computeLabelChanges(['Test::OK'], 'Test::OK');
    expect(action).toBe('noop');
    expect(removeLabels).toEqual([]);
  });

  test('issue déjà Test::WIP → WIP : noop', () => {
    const { action } = computeLabelChanges(['Test::WIP'], 'Test::WIP');
    expect(action).toBe('noop');
  });

  // ── Labels non-Test:: préservés ───────────────────────────────────────────
  test('labels non-Test:: ne sont pas dans removeLabels', () => {
    const { removeLabels } = computeLabelChanges(['Test::KO', 'Bug', 'Sprint::R14'], 'Test::OK');
    expect(removeLabels).toContain('Test::KO');
    expect(removeLabels).not.toContain('Bug');
    expect(removeLabels).not.toContain('Sprint::R14');
  });

  // ── Statut Untested (8) — pas de label ────────────────────────────────────
  test('newLabel=undefined (Untested) → action=skip', () => {
    const { action, addLabel } = computeLabelChanges(['Test::KO'], undefined);
    expect(action).toBe('skip');
    expect(addLabel).toBeNull();
  });

  test('newLabel=null → action=skip, removeLabels vide', () => {
    const { action, removeLabels } = computeLabelChanges(['Test::OK'], null);
    expect(action).toBe('skip');
    expect(removeLabels).toEqual([]);
  });

  // ── Plusieurs labels Test:: simultanément (situation anormale mais possible) ──
  test('issue avec plusieurs labels Test:: → tous retirés sauf le nouveau', () => {
    const { removeLabels, addLabel } = computeLabelChanges(
      ['Test::KO', 'Test::WIP', 'Bug'],
      'Test::OK'
    );
    expect(addLabel).toBe('Test::OK');
    expect(removeLabels).toContain('Test::KO');
    expect(removeLabels).toContain('Test::WIP');
    expect(removeLabels).not.toContain('Bug');
    expect(removeLabels).not.toContain('Test::OK');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests GitLab Status Natif (GitLab 17+)
// ─────────────────────────────────────────────────────────────────────────────


describe('STATUS_TO_GITLAB_STATUS — mapping Testmo status_id → GitLab status natif', () => {
  test('2 (Passed) → GITLAB_STATUS_OK', () => {
    expect(STATUS_TO_GITLAB_STATUS[2]).toBe(GITLAB_STATUS_OK);
  });
  test('3 (Failed) → GITLAB_STATUS_KO', () => {
    expect(STATUS_TO_GITLAB_STATUS[3]).toBe(GITLAB_STATUS_KO);
  });
  test('4 (Retest) → GITLAB_STATUS_RETEST', () => {
    expect(STATUS_TO_GITLAB_STATUS[4]).toBe(GITLAB_STATUS_RETEST);
  });
  test('8 (WIP) → GITLAB_STATUS_WIP', () => {
    expect(STATUS_TO_GITLAB_STATUS[8]).toBe(GITLAB_STATUS_WIP);
  });
  test('1 (Untested) → undefined (ignoré)', () => {
    expect(STATUS_TO_GITLAB_STATUS[1]).toBeUndefined();
  });
  test('statuts inconnus (5, 6, 7) → undefined', () => {
    [5, 6, 7].forEach(id => expect(STATUS_TO_GITLAB_STATUS[id]).toBeUndefined());
  });
  test('statuts mappés (2, 3, 4, 8) → valeur truthy', () => {
    [2, 3, 4, 8].forEach(id => expect(STATUS_TO_GITLAB_STATUS[id]).toBeTruthy());
  });
});

describe('computeStatusChange — logique de mise à jour du status natif', () => {
  test('statuts différents → action=update', () => {
    const { newStatus, action } = computeStatusChange(GITLAB_STATUS_TODO, GITLAB_STATUS_OK);
    expect(newStatus).toBe(GITLAB_STATUS_OK);
    expect(action).toBe('update');
  });

  test('status déjà correct → action=noop', () => {
    const { newStatus, action } = computeStatusChange(GITLAB_STATUS_OK, GITLAB_STATUS_OK);
    expect(newStatus).toBe(GITLAB_STATUS_OK);
    expect(action).toBe('noop');
  });

  test('newStatus=undefined (Untested) → action=skip', () => {
    const { action, newStatus } = computeStatusChange(GITLAB_STATUS_OK, undefined);
    expect(action).toBe('skip');
    expect(newStatus).toBeNull();
  });

  test('newStatus=null → action=skip', () => {
    const { action } = computeStatusChange(GITLAB_STATUS_OK, null);
    expect(action).toBe('skip');
  });

  test('currentStatus=null (issue sans status) + newStatus → action=update', () => {
    const { action } = computeStatusChange(null, GITLAB_STATUS_KO);
    expect(action).toBe('update');
  });
});

describe('VERSION_FIELD_KEY — champ custom version GitLab', () => {
  test('a une valeur par défaut non vide', () => {
    expect(typeof VERSION_FIELD_KEY).toBe('string');
    expect(VERSION_FIELD_KEY.length).toBeGreaterThan(0);
  });

  test('filtrage mémoire par chemin pointé fonctionne', () => {
    const key = 'custom_fields.version';
    const issues = [
      { iid: 1, custom_fields: { version: '1.2.0' } },
      { iid: 2, custom_fields: { version: '1.3.0' } },
      { iid: 3, custom_fields: { version: '1.2.0' } },
      { iid: 4 }
    ];
    const keys = key.split('.');
    const filtered = issues.filter(issue => {
      let val = issue;
      for (const k of keys) val = val?.[k];
      return val === '1.2.0';
    });
    expect(filtered.map(i => i.iid)).toEqual([1, 3]);
  });

  test('filtrage mémoire — version inexistante → 0 résultats', () => {
    const key = 'custom_fields.version';
    const issues = [{ iid: 1, custom_fields: { version: '1.2.0' } }];
    const keys = key.split('.');
    const filtered = issues.filter(issue => {
      let val = issue;
      for (const k of keys) val = val?.[k];
      return val === '9.9.9';
    });
    expect(filtered).toHaveLength(0);
  });

  test('filtrage mémoire — issue sans champ version → exclue', () => {
    const key = 'custom_fields.version';
    const issues = [{ iid: 1 }, { iid: 2, custom_fields: {} }];
    const keys = key.split('.');
    const filtered = issues.filter(issue => {
      let val = issue;
      for (const k of keys) val = val?.[k];
      return val === '1.0.0';
    });
    expect(filtered).toHaveLength(0);
  });
});
