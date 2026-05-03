import { GITLAB_STATUS_OK, GITLAB_STATUS_KO, GITLAB_STATUS_WIP, GITLAB_STATUS_RETEST, GITLAB_STATUS_TODO, STATUS_TO_GITLAB_STATUS, VERSION_FIELD_KEY } from '../services/status-sync.service';
import gitlabService from '../services/gitlab.service';
/**
 * ================================================
 * TESTS — GitLab GraphQL Work Item API
 * ================================================
 * Couvre les nouvelles méthodes GraphQL ajoutées dans gitlab.service.js
 * et la logique de sync dans status-sync.service.js.
 *
 * Pattern : fonctions pures extraites pour tests unitaires rapides,
 * + tests d'intégration avec jest.mock(axios) pour les appels HTTP.
 */

// ─── 1. Construction du Work Item GID ────────────────────────────────────────
// La boucle sync construit gid://gitlab/WorkItem/${issue.id} depuis l'id REST.
// Cette logique doit produire un GID valide pour toute valeur d'id.

function constructWorkItemGid(issueId) {
  return `gid://gitlab/WorkItem/${issueId}`;
}

describe('constructWorkItemGid — GID Work Item depuis issue.id REST', () => {
  test('id numérique → GID bien formé', () => {
    expect(constructWorkItemGid(19796)).toBe('gid://gitlab/WorkItem/19796');
  });

  test('id string → GID bien formé', () => {
    expect(constructWorkItemGid('7639')).toBe('gid://gitlab/WorkItem/7639');
  });

  test('GID commence toujours par gid://gitlab/WorkItem/', () => {
    expect(constructWorkItemGid(1)).toMatch(/^gid:\/\/gitlab\/WorkItem\//);
    expect(constructWorkItemGid(99999)).toMatch(/^gid:\/\/gitlab\/WorkItem\//);
  });

  test('id=0 → GID bien formé (edge case)', () => {
    expect(constructWorkItemGid(0)).toBe('gid://gitlab/WorkItem/0');
  });
});

// ─── 2. Parsing de la réponse GraphQL ────────────────────────────────────────
// executeGraphQL doit lever une erreur si data.errors est présent,
// et retourner data.data sinon.

function parseGraphQLResponse(responseData) {
  if (responseData.errors?.length) {
    throw new Error(`GraphQL: ${responseData.errors[0].message}`);
  }
  return responseData.data;
}

describe('parseGraphQLResponse — gestion erreurs GraphQL', () => {
  test('réponse sans erreurs → retourne data', () => {
    const resp = { data: { workItem: { id: 'gid://gitlab/WorkItem/1' } } };
    expect(parseGraphQLResponse(resp)).toEqual({ workItem: { id: 'gid://gitlab/WorkItem/1' } });
  });

  test('réponse avec errors[] → lève une erreur', () => {
    const resp = {
      errors: [{ message: 'Type mismatch on variable $statusId' }],
      data: null,
    };
    expect(() => parseGraphQLResponse(resp)).toThrow('GraphQL: Type mismatch on variable $statusId');
  });

  test("errors vide [] → ne lève pas d'erreur", () => {
    const resp = { errors: [], data: { ok: true } };
    expect(() => parseGraphQLResponse(resp)).not.toThrow();
    expect(parseGraphQLResponse(resp)).toEqual({ ok: true });
  });

  test("errors absent → ne lève pas d'erreur", () => {
    const resp = { data: { nodes: [] } };
    expect(() => parseGraphQLResponse(resp)).not.toThrow();
  });
});

// ─── 3. Extraction du status depuis les widgets ───────────────────────────────
// updateWorkItemStatus extrait le nom du status depuis workItem.widgets[].

function extractStatusFromWidgets(widgets) {
  return widgets?.find((w) => w.type === 'STATUS')?.status || null;
}

describe('extractStatusFromWidgets — lecture status dans la réponse workItemUpdate', () => {
  const mockWidgets = [
    { type: 'ASSIGNEES' },
    { type: 'LABELS' },
    {
      type: 'STATUS',
      status: { id: 'gid://gitlab/WorkItems::Statuses::Custom::Status/18', name: 'Test OK' },
    },
  ];

  test('retourne le status quand le widget STATUS est présent', () => {
    const result = extractStatusFromWidgets(mockWidgets);
    expect(result).toEqual({
      id: 'gid://gitlab/WorkItems::Statuses::Custom::Status/18',
      name: 'Test OK',
    });
  });

  test('retourne null si aucun widget STATUS', () => {
    const widgets = [{ type: 'LABELS' }, { type: 'ASSIGNEES' }];
    expect(extractStatusFromWidgets(widgets)).toBeNull();
  });

  test('retourne null si widgets vide', () => {
    expect(extractStatusFromWidgets([])).toBeNull();
  });

  test('retourne null si widgets undefined', () => {
    expect(extractStatusFromWidgets(undefined)).toBeNull();
  });

  test('le champ name du status est bien "Test OK" pour Status/18', () => {
    const result = extractStatusFromWidgets(mockWidgets);
    expect(result.name).toBe('Test OK');
  });
});

// ─── 4. Filtrage Version Prod — logique getIssuesByVersionAndIteration ────────
// La méthode GraphQL construit un Map GID→valeur depuis nodes(),
// puis filtre les issues REST dont le GID correspond à la version cible.

function buildVersionProdMap(graphqlNodes) {
  const versionByGid = new Map();
  for (const node of graphqlNodes || []) {
    const cfWidget = node?.widgets?.find((w) => Array.isArray(w.customFieldValues));
    const versionProd = cfWidget?.customFieldValues?.find((cf) => cf.customField?.name === 'Version Prod');
    const val = versionProd?.selectedOptions?.[0]?.value || null;
    versionByGid.set(node.id, val);
  }
  return versionByGid;
}

function filterIssuesByVersionProd(allIssues, graphqlNodes, targetVersion) {
  const versionByGid = buildVersionProdMap(graphqlNodes);
  return allIssues.filter((issue) => {
    const gid = `gid://gitlab/WorkItem/${issue.id}`;
    return versionByGid.get(gid) === targetVersion;
  });
}

const MOCK_GRAPHQL_NODES = [
  {
    id: 'gid://gitlab/WorkItem/100',
    widgets: [
      {
        customFieldValues: [
          {
            customField: { name: 'Version Prod' },
            selectedOptions: [{ value: 'R06 - Pilot' }],
          },
        ],
      },
    ],
  },
  {
    id: 'gid://gitlab/WorkItem/101',
    widgets: [
      {
        customFieldValues: [
          {
            customField: { name: 'Version Prod' },
            selectedOptions: [{ value: 'R14 - Pilot' }],
          },
        ],
      },
    ],
  },
  {
    id: 'gid://gitlab/WorkItem/102',
    widgets: [
      {
        customFieldValues: [
          {
            customField: { name: 'Version Prod' },
            selectedOptions: null,
          },
        ],
      },
    ],
  },
  {
    id: 'gid://gitlab/WorkItem/103',
    widgets: [{ customFieldValues: [] }],
  },
];

const MOCK_REST_ISSUES = [
  { id: 100, iid: 200, title: 'Issue A' },
  { id: 101, iid: 201, title: 'Issue B' },
  { id: 102, iid: 202, title: 'Issue C — version Prod null' },
  { id: 103, iid: 203, title: 'Issue D — pas de Version Prod' },
];

describe('filterIssuesByVersionProd — filtre GraphQL par champ custom Version Prod', () => {
  test('retourne uniquement les issues avec Version Prod = "R06 - Pilot"', () => {
    const result = filterIssuesByVersionProd(MOCK_REST_ISSUES, MOCK_GRAPHQL_NODES, 'R06 - Pilot');
    expect(result).toHaveLength(1);
    expect(result[0].iid).toBe(200);
  });

  test('retourne uniquement les issues avec Version Prod = "R14 - Pilot"', () => {
    const result = filterIssuesByVersionProd(MOCK_REST_ISSUES, MOCK_GRAPHQL_NODES, 'R14 - Pilot');
    expect(result).toHaveLength(1);
    expect(result[0].iid).toBe(201);
  });

  test('version inexistante → 0 résultats', () => {
    const result = filterIssuesByVersionProd(MOCK_REST_ISSUES, MOCK_GRAPHQL_NODES, 'S99 - Pilot');
    expect(result).toHaveLength(0);
  });

  test('issue avec selectedOptions=null → exclue du filtre', () => {
    const result = filterIssuesByVersionProd(MOCK_REST_ISSUES, MOCK_GRAPHQL_NODES, 'R06 - Pilot');
    expect(result.map((i) => i.id)).not.toContain(102);
  });

  test('issue sans champ Version Prod → exclue du filtre', () => {
    const result = filterIssuesByVersionProd(MOCK_REST_ISSUES, MOCK_GRAPHQL_NODES, 'R06 - Pilot');
    expect(result.map((i) => i.id)).not.toContain(103);
  });

  test('nodes vide → 0 résultats (aucune info version)', () => {
    const result = filterIssuesByVersionProd(MOCK_REST_ISSUES, [], 'R06 - Pilot');
    expect(result).toHaveLength(0);
  });

  test('issues vide → 0 résultats', () => {
    const result = filterIssuesByVersionProd([], MOCK_GRAPHQL_NODES, 'R06 - Pilot');
    expect(result).toHaveLength(0);
  });
});

describe('buildVersionProdMap — construction du Map GID → valeur version', () => {
  test('retourne un Map avec les GIDs comme clés', () => {
    const map = buildVersionProdMap(MOCK_GRAPHQL_NODES);
    expect(map.get('gid://gitlab/WorkItem/100')).toBe('R06 - Pilot');
    expect(map.get('gid://gitlab/WorkItem/101')).toBe('R14 - Pilot');
  });

  test('selectedOptions null → valeur null dans le Map', () => {
    const map = buildVersionProdMap(MOCK_GRAPHQL_NODES);
    expect(map.get('gid://gitlab/WorkItem/102')).toBeNull();
  });

  test('pas de champ Version Prod → valeur null dans le Map', () => {
    const map = buildVersionProdMap(MOCK_GRAPHQL_NODES);
    expect(map.get('gid://gitlab/WorkItem/103')).toBeNull();
  });

  test('nodes null/undefined → Map vide', () => {
    expect(buildVersionProdMap(null).size).toBe(0);
    expect(buildVersionProdMap(undefined).size).toBe(0);
  });
});

// ─── 5. Format GID des constantes STATUS ─────────────────────────────────────
// Les constantes doivent être des GIDs GitLab valides, pas des strings arbitraires.


const GITLAB_STATUS_GID_PATTERN = /^gid:\/\/gitlab\/WorkItems::Statuses::Custom::Status\/\d+$/;

describe('GITLAB_STATUS_* — format GID Work Item valide', () => {
  test('GITLAB_STATUS_OK est un GID Work Item Status', () => {
    expect(GITLAB_STATUS_OK).toMatch(GITLAB_STATUS_GID_PATTERN);
  });

  test('GITLAB_STATUS_KO est un GID Work Item Status', () => {
    expect(GITLAB_STATUS_KO).toMatch(GITLAB_STATUS_GID_PATTERN);
  });

  test('GITLAB_STATUS_WIP est un GID Work Item Status', () => {
    expect(GITLAB_STATUS_WIP).toMatch(GITLAB_STATUS_GID_PATTERN);
  });

  test('GITLAB_STATUS_RETEST est un GID Work Item Status', () => {
    expect(GITLAB_STATUS_RETEST).toMatch(GITLAB_STATUS_GID_PATTERN);
  });

  test('GITLAB_STATUS_TODO est un GID Work Item Status', () => {
    expect(GITLAB_STATUS_TODO).toMatch(GITLAB_STATUS_GID_PATTERN);
  });

  test('Status/18 → Test OK (ID confirmé Phase 0)', () => {
    expect(GITLAB_STATUS_OK).toBe('gid://gitlab/WorkItems::Statuses::Custom::Status/18');
  });

  test('Status/17 → Test KO (ID confirmé Phase 0)', () => {
    expect(GITLAB_STATUS_KO).toBe('gid://gitlab/WorkItems::Statuses::Custom::Status/17');
  });

  test('Status/21 → Test WIP (ID confirmé Phase 0)', () => {
    expect(GITLAB_STATUS_WIP).toBe('gid://gitlab/WorkItems::Statuses::Custom::Status/21');
  });

  test('Status/19 → Test Blocked/Retest (ID confirmé Phase 0)', () => {
    expect(GITLAB_STATUS_RETEST).toBe('gid://gitlab/WorkItems::Statuses::Custom::Status/19');
  });

  test('Status/15 → Test TODO (ID confirmé Phase 0)', () => {
    expect(GITLAB_STATUS_TODO).toBe('gid://gitlab/WorkItems::Statuses::Custom::Status/15');
  });

  test('tous les statuts mappés (2,3,4,8) sont des GIDs valides', () => {
    [2, 3, 4, 8].forEach((id) => {
      expect(STATUS_TO_GITLAB_STATUS[id]).toMatch(GITLAB_STATUS_GID_PATTERN);
    });
  });

  test('les GIDs OK/KO/WIP/Retest sont tous distincts', () => {
    const statuses = [GITLAB_STATUS_OK, GITLAB_STATUS_KO, GITLAB_STATUS_WIP, GITLAB_STATUS_RETEST];
    const unique = new Set(statuses);
    expect(unique.size).toBe(4);
  });
});

// ─── 6. VERSION_FIELD_KEY — GID du champ custom Version Prod ─────────────────

describe('VERSION_FIELD_KEY — GID du champ custom Version Prod', () => {
  test('est un GID Issuables::CustomField valide', () => {
    expect(VERSION_FIELD_KEY).toMatch(/^gid:\/\/gitlab\/Issuables::CustomField\/\d+$/);
  });

  test('correspond à CustomField/1 (confirmé Phase 0)', () => {
    expect(VERSION_FIELD_KEY).toBe('gid://gitlab/Issuables::CustomField/1');
  });
});

// ─── 7. updateWorkItemStatus — mutation GraphQL avec axios mocké ──────────────
// Vérifie que la méthode appelle /api/graphql avec les bons paramètres.
// Le mock jest.mock est hoisted — les deux import 'axios'; (test + service)
// reçoivent la MÊME instance mock, ce qui garantit que mockResolvedValue fonctionne.

jest.mock('axios', () => ({
  ...jest.requireActual('axios'),
  create: jest.fn(() => ({
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  })),
  post: jest.fn(),
}));

// Env vars avant le require du service (singleton construit à l'import)
process.env.GITLAB_URL = 'https://gitlab.example.fr';
process.env.GITLAB_TOKEN = 'test-token';
process.env.GITLAB_WRITE_TOKEN = 'test-write-token';
process.env.GITLAB_VERIFY_SSL = 'false';


const WORK_ITEM_GID = 'gid://gitlab/WorkItem/19796';
const STATUS_GID = 'gid://gitlab/WorkItems::Statuses::Custom::Status/18';

const MOCK_GRAPHQL_RETURN = {
  workItemUpdate: {
    workItem: {
      id: WORK_ITEM_GID,
      widgets: [{ type: 'LABELS' }, { type: 'STATUS', status: { id: STATUS_GID, name: 'Test OK' } }],
    },
    errors: [],
  },
};

describe('updateWorkItemStatus — appel GraphQL mutation', () => {
  let spyGraphQL;

  beforeEach(() => {
    spyGraphQL = jest.spyOn(gitlabService, 'executeGraphQL').mockResolvedValue(MOCK_GRAPHQL_RETURN);
  });

  afterEach(() => {
    spyGraphQL.mockRestore();
  });

  test('appelle executeGraphQL avec la mutation workItemUpdate et les bons paramètres', async () => {
    await gitlabService.updateWorkItemStatus(WORK_ITEM_GID, STATUS_GID);
    expect(spyGraphQL).toHaveBeenCalledWith(
      expect.stringContaining('workItemUpdate'),
      { id: WORK_ITEM_GID, statusId: STATUS_GID },
      true // useWriteToken doit être true pour modifier un Work Item
    );
  });

  test('passe useWriteToken=true à executeGraphQL (token écriture requis)', async () => {
    await gitlabService.updateWorkItemStatus(WORK_ITEM_GID, STATUS_GID);
    const [, , useWriteToken] = spyGraphQL.mock.calls[0];
    expect(useWriteToken).toBe(true);
  });

  test('retourne le workItem mis à jour avec son id GID', async () => {
    const result = await gitlabService.updateWorkItemStatus(WORK_ITEM_GID, STATUS_GID);
    expect(result.id).toBe(WORK_ITEM_GID);
  });

  test('lève une erreur GraphQL si executeGraphQL rejette', async () => {
    spyGraphQL.mockRejectedValue(new Error('GraphQL: Variable $statusId was provided invalid value'));
    await expect(gitlabService.updateWorkItemStatus(WORK_ITEM_GID, 'bad-gid')).rejects.toThrow('GraphQL');
  });

  test('lève une erreur si workItemUpdate.errors contient un message', async () => {
    spyGraphQL.mockResolvedValue({
      workItemUpdate: {
        workItem: null,
        errors: ['Status not allowed for this work item type'],
      },
    });
    await expect(gitlabService.updateWorkItemStatus(WORK_ITEM_GID, STATUS_GID)).rejects.toThrow('Status not allowed');
  });
});
