/**
 * ================================================
 * TESTS DE DÉTECTION DES CAS ENRICHIS
 * ================================================
 * Vérifie la protection anti-écrasement des cas de test enrichis.
 */

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

  const nonEmptySteps = (testCase.custom_steps || []).filter(s => {
    const content = typeof s === 'object' ? (s.text1 || s.step || s.content || '') : String(s || '');
    return content.trim().length > 0;
  });
  if (nonEmptySteps.length > 0) return true;

  return false;
}

describe('isCaseEnriched — protection anti-écrasement des cas enrichis', () => {
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

  test('tag objet avec champ .tag (pas .name) → ne crash pas, auto-tag ignoré', () => {
    const c = { tags: [{ id: 5, tag: 'sync-auto' }, { id: 6, tag: 'gitlab-6015' }] };
    expect(() => isCaseEnriched(c)).not.toThrow();
    expect(isCaseEnriched(c)).toBe(false);
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
