/**
 * ================================================
 * TESTS — Mode "version seule sans itération"
 * ================================================
 * Couvre :
 *   1. buildVersionAndStatusMap   — Map GID → { version, statusGid }
 *   2. filterIssuesByVersionOnly  — filtre version + status TODO
 *   3. resolveMode                — routing iteration vs version-only
 *   4. Validator syncStatusToGitlabBody — iterationName optionnel avec version
 */

const TODO_STATUS_GID = 'gid://gitlab/WorkItems::Statuses::Custom::Status/15';
const OK_STATUS_GID = 'gid://gitlab/WorkItems::Statuses::Custom::Status/18';
const KO_STATUS_GID = 'gid://gitlab/WorkItems::Statuses::Custom::Status/17';

// ─── Fonctions pures extraites de gitlab.service.js ──────────────────────────

function buildVersionAndStatusMap(graphqlNodes) {
  const map = new Map();
  for (const node of graphqlNodes || []) {
    const cfWidget = node?.widgets?.find((w) => Array.isArray(w.customFieldValues));
    const statusWidget = node?.widgets?.find((w) => w.type === 'STATUS');
    const versionProd = cfWidget?.customFieldValues?.find((cf) => cf.customField?.name === 'Version Prod');
    const version = versionProd?.selectedOptions?.[0]?.value || null;
    const statusGid = statusWidget?.status?.id || null;
    map.set(node.id, { version, statusGid });
  }
  return map;
}

function filterIssuesByVersionOnly(allIssues, graphqlNodes, targetVersion, todoStatusGid) {
  const infoMap = buildVersionAndStatusMap(graphqlNodes);
  return allIssues.filter((issue) => {
    const gid = `gid://gitlab/WorkItem/${issue.id}`;
    const info = infoMap.get(gid);
    return info?.version === targetVersion && info?.statusGid === todoStatusGid;
  });
}

// ─── Fonction pure extraite de status-sync.service.js ────────────────────────

function resolveMode(iterationName, version) {
  if (iterationName) return 'iteration';
  if (version) return 'version-only';
  throw new Error('iterationName ou version requis');
}

// ─── Données de test ──────────────────────────────────────────────────────────

const MOCK_NODES = [
  // Issue 100 : version R06, status TODO → doit être sélectionnée
  {
    id: 'gid://gitlab/WorkItem/100',
    widgets: [
      {
        type: 'CUSTOM_FIELDS',
        customFieldValues: [
          {
            customField: { id: 'gid://gitlab/Issuables::CustomField/1', name: 'Version Prod' },
            selectedOptions: [{ value: 'R06 - Pilot' }],
          },
        ],
      },
      { type: 'STATUS', status: { id: TODO_STATUS_GID, name: 'Test TODO' } },
    ],
  },
  // Issue 101 : version R06, status OK → exclue (pas TODO)
  {
    id: 'gid://gitlab/WorkItem/101',
    widgets: [
      {
        type: 'CUSTOM_FIELDS',
        customFieldValues: [
          {
            customField: { id: 'gid://gitlab/Issuables::CustomField/1', name: 'Version Prod' },
            selectedOptions: [{ value: 'R06 - Pilot' }],
          },
        ],
      },
      { type: 'STATUS', status: { id: OK_STATUS_GID, name: 'Test OK' } },
    ],
  },
  // Issue 102 : version R14, status TODO → exclue (mauvaise version)
  {
    id: 'gid://gitlab/WorkItem/102',
    widgets: [
      {
        type: 'CUSTOM_FIELDS',
        customFieldValues: [
          {
            customField: { id: 'gid://gitlab/Issuables::CustomField/1', name: 'Version Prod' },
            selectedOptions: [{ value: 'R14 - Pilot' }],
          },
        ],
      },
      { type: 'STATUS', status: { id: TODO_STATUS_GID, name: 'Test TODO' } },
    ],
  },
  // Issue 103 : sans Version Prod, status TODO → exclue (version null)
  {
    id: 'gid://gitlab/WorkItem/103',
    widgets: [
      { type: 'CUSTOM_FIELDS', customFieldValues: [] },
      { type: 'STATUS', status: { id: TODO_STATUS_GID, name: 'Test TODO' } },
    ],
  },
  // Issue 104 : version R06, sans widget STATUS → exclue (statusGid null)
  {
    id: 'gid://gitlab/WorkItem/104',
    widgets: [
      {
        type: 'CUSTOM_FIELDS',
        customFieldValues: [
          {
            customField: { id: 'gid://gitlab/Issuables::CustomField/1', name: 'Version Prod' },
            selectedOptions: [{ value: 'R06 - Pilot' }],
          },
        ],
      },
    ],
  },
];

const MOCK_ISSUES = [
  { id: 100, iid: 200, title: 'Test login' },
  { id: 101, iid: 201, title: 'Test logout' },
  { id: 102, iid: 202, title: 'Test export R14' },
  { id: 103, iid: 203, title: 'Test sans version' },
  { id: 104, iid: 204, title: 'Test sans status' },
];

// ─── 1. buildVersionAndStatusMap ─────────────────────────────────────────────

describe('buildVersionAndStatusMap — Map GID → { version, statusGid }', () => {
  test('issue avec version R06 + status TODO → mappée correctement', () => {
    const map = buildVersionAndStatusMap(MOCK_NODES);
    expect(map.get('gid://gitlab/WorkItem/100')).toEqual({
      version: 'R06 - Pilot',
      statusGid: TODO_STATUS_GID,
    });
  });

  test('issue avec version R06 + status OK → statusGid = OK_STATUS_GID', () => {
    const map = buildVersionAndStatusMap(MOCK_NODES);
    expect(map.get('gid://gitlab/WorkItem/101')).toEqual({
      version: 'R06 - Pilot',
      statusGid: OK_STATUS_GID,
    });
  });

  test('issue sans Version Prod → version null dans le Map', () => {
    const map = buildVersionAndStatusMap(MOCK_NODES);
    expect(map.get('gid://gitlab/WorkItem/103')?.version).toBeNull();
  });

  test('issue sans widget STATUS → statusGid null dans le Map', () => {
    const map = buildVersionAndStatusMap(MOCK_NODES);
    expect(map.get('gid://gitlab/WorkItem/104')?.statusGid).toBeNull();
  });

  test('nodes null → Map vide', () => {
    expect(buildVersionAndStatusMap(null).size).toBe(0);
  });

  test('nodes undefined → Map vide', () => {
    expect(buildVersionAndStatusMap(undefined).size).toBe(0);
  });

  test('nodes vide → Map vide', () => {
    expect(buildVersionAndStatusMap([]).size).toBe(0);
  });

  test('toutes les issues sont dans le Map (une entrée par node)', () => {
    const map = buildVersionAndStatusMap(MOCK_NODES);
    expect(map.size).toBe(MOCK_NODES.length);
  });
});

// ─── 2. filterIssuesByVersionOnly ────────────────────────────────────────────

describe('filterIssuesByVersionOnly — filtre version ET status Test TODO', () => {
  test("retourne uniquement l'issue avec version=R06 ET status=TODO", () => {
    const result = filterIssuesByVersionOnly(MOCK_ISSUES, MOCK_NODES, 'R06 - Pilot', TODO_STATUS_GID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(100);
  });

  test('exclut les issues avec la bonne version mais status ≠ TODO', () => {
    const result = filterIssuesByVersionOnly(MOCK_ISSUES, MOCK_NODES, 'R06 - Pilot', TODO_STATUS_GID);
    expect(result.map((i) => i.id)).not.toContain(101); // OK status
  });

  test('exclut les issues avec status TODO mais mauvaise version', () => {
    const result = filterIssuesByVersionOnly(MOCK_ISSUES, MOCK_NODES, 'R06 - Pilot', TODO_STATUS_GID);
    expect(result.map((i) => i.id)).not.toContain(102); // R14 version
  });

  test('exclut les issues sans Version Prod (version null)', () => {
    const result = filterIssuesByVersionOnly(MOCK_ISSUES, MOCK_NODES, 'R06 - Pilot', TODO_STATUS_GID);
    expect(result.map((i) => i.id)).not.toContain(103);
  });

  test('exclut les issues sans widget STATUS (statusGid null)', () => {
    const result = filterIssuesByVersionOnly(MOCK_ISSUES, MOCK_NODES, 'R06 - Pilot', TODO_STATUS_GID);
    expect(result.map((i) => i.id)).not.toContain(104);
  });

  test('version inexistante dans les nodes → 0 résultats', () => {
    const result = filterIssuesByVersionOnly(MOCK_ISSUES, MOCK_NODES, 'S99 - Pilot', TODO_STATUS_GID);
    expect(result).toHaveLength(0);
  });

  test('nodes vide → 0 résultats (aucune info disponible)', () => {
    const result = filterIssuesByVersionOnly(MOCK_ISSUES, [], 'R06 - Pilot', TODO_STATUS_GID);
    expect(result).toHaveLength(0);
  });

  test('issues vide → 0 résultats', () => {
    const result = filterIssuesByVersionOnly([], MOCK_NODES, 'R06 - Pilot', TODO_STATUS_GID);
    expect(result).toHaveLength(0);
  });

  test('filtre sur R14 + TODO → retourne issue 102', () => {
    const result = filterIssuesByVersionOnly(MOCK_ISSUES, MOCK_NODES, 'R14 - Pilot', TODO_STATUS_GID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(102);
  });

  test('todoStatusGid différent → 0 résultats (aucun match status)', () => {
    const result = filterIssuesByVersionOnly(MOCK_ISSUES, MOCK_NODES, 'R06 - Pilot', KO_STATUS_GID);
    expect(result).toHaveLength(0);
  });
});

// ─── 3. resolveMode — routing iteration vs version-only ─────────────────────

describe('resolveMode — choix du chemin de sync', () => {
  test('iterationName non vide → mode "iteration"', () => {
    expect(resolveMode('R10 - run 1', null)).toBe('iteration');
  });

  test('iterationName vide + version fournie → mode "version-only"', () => {
    expect(resolveMode('', 'R06 - Pilot')).toBe('version-only');
  });

  test('iterationName null + version fournie → mode "version-only"', () => {
    expect(resolveMode(null, 'R06 - Pilot')).toBe('version-only');
  });

  test('iterationName undefined + version fournie → mode "version-only"', () => {
    expect(resolveMode(undefined, 'R06 - Pilot')).toBe('version-only');
  });

  test('les deux vides → throw Error', () => {
    expect(() => resolveMode('', '')).toThrow('iterationName ou version requis');
  });

  test('les deux null → throw Error', () => {
    expect(() => resolveMode(null, null)).toThrow('iterationName ou version requis');
  });

  test('iterationName présent + version présente → priorité "iteration"', () => {
    // Si les deux sont fournis, le chemin itération est prioritaire (comportement actuel)
    expect(resolveMode('R10 - run 1', 'R06 - Pilot')).toBe('iteration');
  });
});

// ─── 4. Validator — iterationName optionnel quand version est fourni ──────────

describe('syncStatusToGitlabBody validator — iterationName optionnel avec version', () => {
  let schema;

  beforeAll(() => {
    const { z } = require('zod');
    schema = z
      .object({
        runId: z.number().int().positive(),
        iterationName: z.string().optional(),
        gitlabProjectId: z.union([z.string(), z.number()]),
        dryRun: z.boolean().optional(),
        version: z.string().optional(),
      })
      .refine((data) => data.iterationName || data.version, { error: 'iterationName ou version requis' });
  });

  test('iterationName seul → valide', () => {
    expect(() => schema.parse({ runId: 1, iterationName: 'R10 - run 1', gitlabProjectId: 63 })).not.toThrow();
  });

  test('version seule sans iterationName → valide', () => {
    expect(() => schema.parse({ runId: 1, version: 'R06 - Pilot', gitlabProjectId: 63 })).not.toThrow();
  });

  test('iterationName + version → valide', () => {
    expect(() => schema.parse({ runId: 1, iterationName: 'R10', version: 'R06', gitlabProjectId: 63 })).not.toThrow();
  });

  test('ni iterationName ni version → invalide', () => {
    expect(() => schema.parse({ runId: 1, gitlabProjectId: 63 })).toThrow();
  });

  test('runId absent → invalide', () => {
    expect(() => schema.parse({ iterationName: 'R10', gitlabProjectId: 63 })).toThrow();
  });

  test('gitlabProjectId accepte un nombre', () => {
    expect(() => schema.parse({ runId: 1, iterationName: 'R10', gitlabProjectId: 63 })).not.toThrow();
  });

  test('gitlabProjectId accepte une chaîne', () => {
    expect(() => schema.parse({ runId: 1, iterationName: 'R10', gitlabProjectId: '63' })).not.toThrow();
  });
});

// ─── 5. Tests production — GitLabService.getIssuesByVersionOnly ──────────────
// Vérifie l'existence et la signature de la méthode sans instanciation.

describe('GitLabService.getIssuesByVersionOnly — existence et signature', () => {
  test('la méthode getIssuesByVersionOnly existe sur le prototype', () => {
    const { GitLabService: GLS } = require('../services/gitlab.service');
    expect(typeof GLS.prototype.getIssuesByVersionOnly).toBe('function');
  });

  test('la méthode est asynchrone (retourne une Promise)', () => {
    const { GitLabService: GLS } = require('../services/gitlab.service');
    // Une fonction async a un constructor.name === 'AsyncFunction'
    expect(GLS.prototype.getIssuesByVersionOnly.constructor.name).toBe('AsyncFunction');
  });
});

// ─── 6. Tests production — validateur réel syncStatusToGitlabBody ─────────────

describe('syncStatusToGitlabBody (production) — iterationName optionnel avec version', () => {
  let syncStatusToGitlabBody;

  beforeAll(() => {
    ({ syncStatusToGitlabBody } = require('../validators'));
  });

  test('version seule (sans iterationName) → parse réussit', () => {
    expect(() =>
      syncStatusToGitlabBody.parse({
        runId: 279,
        version: 'R06 - Pilot',
        gitlabProjectId: 63,
      })
    ).not.toThrow();
  });

  test('ni iterationName ni version → parse échoue', () => {
    expect(() =>
      syncStatusToGitlabBody.parse({
        runId: 279,
        gitlabProjectId: 63,
      })
    ).toThrow();
  });

  test('iterationName seul → parse réussit (rétrocompatible)', () => {
    expect(() =>
      syncStatusToGitlabBody.parse({
        runId: 279,
        iterationName: 'R10 - run 1',
        gitlabProjectId: 63,
      })
    ).not.toThrow();
  });
});
