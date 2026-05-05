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

  test("TEST placé en dernier même s'il est premier dans le commentaire", () => {
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

  test("deux notes avec [TEST] → les deux steps TEST collectés dans l'ordre chronologique", () => {
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

  test("trois notes avec [TEST] → 3 steps TEST dans l'ordre chronologique", () => {
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
