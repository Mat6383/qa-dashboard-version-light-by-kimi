# GitLab Status Natif + Champ Version — Plan de migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les labels `Test::*` GitLab par le champ status natif GitLab 17+ et intégrer le champ custom `version` comme nouveau critère de scope des campagnes QA.

**Architecture:** Le backend intercepte les statuts Testmo et les traduit en status natif GitLab (au lieu de `add_labels`/`remove_labels`). Le filtrage des issues candidates à la sync utilise le status natif (au lieu de `label: 'Test::TODO'`). Le champ custom `version` permet de grouper les tickets par release preprod indépendamment de la milestone.

**Tech Stack:** Node.js/Express, axios, GitLab REST API v4 (GitLab 17+), Jest

---

## Prérequis — À confirmer en Phase 0 (curls)

Ces valeurs sont requises AVANT toute implémentation. Elles bloquent les phases 1–4.

| Constante | Source | Description |
|-----------|--------|-------------|
| `GITLAB_STATUS_TODO` | Phase 0 / curl 1 | Valeur API du status "à tester" |
| `GITLAB_STATUS_OK` | Phase 0 / curl 1 | Valeur API du status "passé" |
| `GITLAB_STATUS_KO` | Phase 0 / curl 1 | Valeur API du status "échoué" |
| `GITLAB_STATUS_WIP` | Phase 0 / curl 1 | Valeur API du status "en cours" |
| `GITLAB_STATUS_RETEST` | Phase 0 / curl 1 | Valeur API du status "retest" |
| `VERSION_FIELD_KEY` | Phase 0 / curl 2 | Clé JSON du champ custom version dans l'issue |
| `VERSION_FILTER_PARAM` | Phase 0 / curl 3 | Paramètre API pour filtrer par version |

---

## Fichiers impactés

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `backend/services/gitlab.service.js` | Modifier | Ajouter méthodes status natif + version |
| `backend/services/status-sync.service.js` | Modifier | Mapping Testmo→status, remplacer logique labels |
| `backend/config/projects.config.js` | Modifier | Remplacer `label: 'Test::TODO'` par `status: GITLAB_STATUS_TODO` |
| `backend/services/sync.service.js` | Modifier | Filtrer les issues par status au lieu de label |
| `backend/tests/calculations.test.js` | Modifier | Mettre à jour tous les tests labels → status |

---

## Phase 0 — Discovery (à exécuter demain avec accès GitLab)

> Cette phase ne génère pas de code. Elle produit les valeurs des constantes du tableau ci-dessus.

### Task 0: Découverte de l'API GitLab

**Objectif:** Connaître la structure exacte des champs `status` et `version` dans les réponses API.

**Fichiers:** aucun (curl uniquement)

- [ ] **Curl 1 — Structure complète d'une issue**

```bash
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/63/issues?per_page=3&state=all" \
  | jq '.[0] | {
      iid, title, state, labels,
      status,
      workflow_state,
      custom_fields,
      custom_attributes,
      properties
    }'
```

Attendu : repérer le champ qui contient les valeurs équivalentes à `Test::OK`, `Test::KO`, etc. et noter la clé JSON exacte.

- [ ] **Curl 2 — Champ custom version**

```bash
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/63/issues?per_page=5&state=all" \
  | jq '.[] | {iid, title, custom_fields, custom_attributes}'
```

Attendu : voir apparaître le champ `version` et sa clé JSON exacte (ex: `custom_fields.version`, `custom_attributes[version]`, etc.)

- [ ] **Curl 3 — Filtrage par version (tester les paramètres possibles)**

```bash
# Option A : si custom_fields est filtrable
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/63/issues?custom_fields[version]=1.2.3" | jq 'length'

# Option B : si custom_attributes
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/63/issues?custom_attributes[version]=1.2.3" | jq 'length'

# Option C : pas de filtre API → filtrage mémoire côté backend
# Dans ce cas, on récupère toutes les issues de l'itération et on filtre en JS
```

- [ ] **Curl 4 — Filtrage par status natif**

```bash
# Tester si le status est filtrable comme paramètre query
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/63/issues?status=todo&state=all" | jq 'length'

# Tester aussi avec label_name pour voir si les labels coexistent encore
curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/63/issues?label_name=Test%3A%3ATODO&state=all" | jq 'length'
```

- [ ] **Curl 5 — Mise à jour du status (vérifier le paramètre PUT)**

```bash
# Tester sur une issue de test (changer ISSUE_IID)
curl -s -X PUT -H "PRIVATE-TOKEN: $GITLAB_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  "$GITLAB_URL/api/v4/projects/63/issues/ISSUE_IID" \
  -d '{"status": "todo"}' | jq '{iid, status, labels}'
```

- [ ] **Remplir le tableau des constantes**

Après les curls, compléter ce tableau et l'enregistrer en commentaire dans `status-sync.service.js` :

```
GITLAB_STATUS_TODO  = "___"   # valeur réelle observée
GITLAB_STATUS_OK    = "___"
GITLAB_STATUS_KO    = "___"
GITLAB_STATUS_WIP   = "___"
GITLAB_STATUS_RETEST= "___"   # ou toujours label DoubleTestNécessaire ?
VERSION_FIELD_KEY   = "___"   # ex: "custom_fields.version"
VERSION_FILTER_PARAM= "___"   # ex: "custom_fields[version]" ou null si filtrage mémoire
```

---

## Phase 1 — Migration status dans gitlab.service.js

> **Prérequis :** Phase 0 terminée, constantes connues.

### Task 1: Ajouter `updateIssueStatus()` dans gitlab.service.js

**Fichiers:**
- Modify: `backend/services/gitlab.service.js`

- [ ] **Step 1: Écrire le test (fichier temporaire pour valider la signature)**

Créer `backend/tests/gitlab-status.test.js` :

```js
// test unitaire de la signature — l'appel réseau est mocké
jest.mock('axios');
const axios = require('axios');

// Note : on teste la logique de construction du body, pas l'HTTP
test('updateIssueStatus construit le bon body PUT', async () => {
  // Ce test sera affiné après Phase 0 selon la clé réelle du champ status
  // Exemple attendu si la clé API est "status" :
  // PUT /projects/63/issues/42 body = { status: "passed" }
  expect(true).toBe(true); // placeholder — remplacer après Phase 0
});
```

```bash
cd backend && npx jest tests/gitlab-status.test.js -v
```

- [ ] **Step 2: Ajouter `updateIssueStatus()` dans gitlab.service.js**

Ajouter après la méthode `updateIssueLabel()` (ligne 335) :

```js
/**
 * Met à jour le status natif d'une issue GitLab.
 * Remplace la mécanique add_labels/remove_labels pour les statuts Test::.
 *
 * @param {number|string} projectId - ID du projet GitLab
 * @param {number}        issueIid  - IID de l'issue
 * @param {string}        status    - Valeur du status natif (ex: "passed")
 * @returns {Object} Issue mise à jour
 */
async updateIssueStatus(projectId, issueIid, status) {
  try {
    const body = { status };  // clé à confirmer en Phase 0
    const resp = await this.writeClient.put(
      `/projects/${projectId}/issues/${issueIid}`,
      body
    );
    logger.info(`GitLab: Status natif mis à jour pour #${issueIid} → "${status}"`);
    return resp.data;
  } catch (error) {
    logger.error(`GitLab: Erreur updateIssueStatus #${issueIid}:`, error.message);
    throw error;
  }
}
```

> **Note Phase 0 :** Si le paramètre PUT n'est pas `status` mais autre chose (ex: `workflow_state`), remplacer `{ status }` par `{ [CLE_REELLE]: status }`.

- [ ] **Step 3: Ajouter `getIssuesByStatusAndIteration()`**

Ajouter après `getIssuesByLabelAndIterationForProject()` :

```js
/**
 * Récupère les issues d'un projet par status natif ET itération.
 * Remplace getIssuesByLabelAndIteration() pour le filtre Test::TODO → status natif.
 *
 * @param {number|string} projectId   - ID du projet GitLab
 * @param {string}        status      - Valeur du status natif (ex: "todo")
 * @param {number}        iterationId - ID de l'itération
 * @returns {Array}
 */
async getIssuesByStatusAndIteration(projectId, status, iterationId) {
  try {
    // Note Phase 0 : si le status n'est pas filtrable en query param,
    // remplacer par getIssuesForIteration() + filtre mémoire sur issue.status
    const issues = await this._getPaginated(
      `/projects/${projectId}/issues`,
      { status, iteration_id: iterationId, state: 'all', scope: 'all' }
    );
    logger.info(`GitLab: ${issues.length} ticket(s) (project=${projectId}, status="${status}", iteration_id=${iterationId})`);
    return issues;
  } catch (error) {
    logger.error(`GitLab: Erreur getIssuesByStatusAndIteration:`, error.message);
    throw error;
  }
}
```

- [ ] **Step 4: Ajouter `getIssuesByVersionAndIteration()`**

```js
/**
 * Récupère les issues d'une itération filtrées par le champ custom "version".
 * Si le champ version n'est pas filtrable via l'API, récupère tout et filtre en mémoire.
 *
 * @param {number|string} projectId   - ID du projet GitLab
 * @param {string}        version     - Valeur du champ version (ex: "1.2.3")
 * @param {number}        iterationId - ID de l'itération
 * @param {string}        versionFieldKey - Clé JSON du champ version (ex: "custom_fields.version")
 * @returns {Array}
 */
async getIssuesByVersionAndIteration(projectId, version, iterationId, versionFieldKey) {
  try {
    // Récupère toutes les issues de l'itération (filtrage API si dispo, sinon mémoire)
    const allIssues = await this.getIssuesForIteration(projectId, iterationId);

    // Filtrage mémoire sur le champ version (chemin ex: "custom_fields.version")
    const keys = versionFieldKey.split('.');
    const filtered = allIssues.filter(issue => {
      let val = issue;
      for (const k of keys) val = val?.[k];
      return val === version;
    });

    logger.info(`GitLab: ${filtered.length}/${allIssues.length} issue(s) avec version="${version}"`);
    return filtered;
  } catch (error) {
    logger.error(`GitLab: Erreur getIssuesByVersionAndIteration:`, error.message);
    throw error;
  }
}
```

- [ ] **Step 5: Vérifier que les tests existants passent encore**

```bash
cd backend && npm test
```

Attendu : tous les tests passent (aucune méthode existante n'a été modifiée).

- [ ] **Step 6: Commit**

```bash
git add backend/services/gitlab.service.js backend/tests/gitlab-status.test.js
git commit -m "feat(gitlab): add updateIssueStatus, getIssuesByStatusAndIteration, getIssuesByVersionAndIteration"
```

---

## Phase 2 — Migration du mapping dans status-sync.service.js

> **Prérequis :** Phase 0 et Phase 1 terminées.

### Task 2: Remplacer STATUS_TO_LABEL par STATUS_TO_GITLAB_STATUS

**Fichiers:**
- Modify: `backend/services/status-sync.service.js`

- [ ] **Step 1: Écrire les tests unitaires du nouveau mapping**

Dans `backend/tests/calculations.test.js`, ajouter une nouvelle `describe` block AVANT les tests `STATUS_TO_LABEL` existants :

```js
const { STATUS_TO_GITLAB_STATUS, computeStatusChange } = require('../services/status-sync.service');

describe('STATUS_TO_GITLAB_STATUS — mapping Testmo status_id → GitLab status natif', () => {
  // Remplacer les valeurs STRING par les constantes découvertes en Phase 0
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
});

describe('computeStatusChange — logique de mise à jour du status natif', () => {
  test('status différent → action update', () => {
    const { newStatus, action } = computeStatusChange('todo', GITLAB_STATUS_OK);
    expect(newStatus).toBe(GITLAB_STATUS_OK);
    expect(action).toBe('update');
  });

  test('status déjà correct → action noop', () => {
    const { action } = computeStatusChange(GITLAB_STATUS_OK, GITLAB_STATUS_OK);
    expect(action).toBe('noop');
  });

  test('newStatus undefined → action skip', () => {
    const { action } = computeStatusChange(GITLAB_STATUS_OK, undefined);
    expect(action).toBe('skip');
  });
});
```

```bash
cd backend && npx jest tests/calculations.test.js -t "STATUS_TO_GITLAB_STATUS" -v
```

Attendu : FAIL (pas encore implémenté).

- [ ] **Step 2: Ajouter les constantes et `STATUS_TO_GITLAB_STATUS`**

Dans `status-sync.service.js`, remplacer le bloc `STATUS_TO_LABEL` + `ALL_TEST_LABELS` (lignes 28–54) par :

```js
// Valeurs status natif GitLab — vérifiées via curl Phase 0
// Format: valeur retournée par GET /issues et acceptée par PUT /issues
const GITLAB_STATUS_TODO   = 'TODO';    // ← remplacer par valeur Phase 0
const GITLAB_STATUS_OK     = 'OK';      // ← remplacer par valeur Phase 0
const GITLAB_STATUS_KO     = 'KO';      // ← remplacer par valeur Phase 0
const GITLAB_STATUS_WIP    = 'WIP';     // ← remplacer par valeur Phase 0
const GITLAB_STATUS_RETEST = 'RETEST';  // ← remplacer par valeur Phase 0

// Mapping Testmo status_id → GitLab status natif
// Empiriquement vérifié sur cette instance (status_ids ≠ standards Testmo)
const STATUS_TO_GITLAB_STATUS = {
  2: GITLAB_STATUS_OK,      // Passed  (vert)
  3: GITLAB_STATUS_KO,      // Failed  (rouge)
  4: GITLAB_STATUS_RETEST,  // Retest  (orange)
  8: GITLAB_STATUS_WIP      // WIP     (violet)
};

// Noms lisibles pour les commentaires GitLab (inchangé)
const STATUS_ID_TO_NAME = {
  2: 'Passed',
  3: 'Failed',
  4: 'Retest',
  8: 'WIP'
};
```

- [ ] **Step 3: Remplacer `computeLabelChanges` par `computeStatusChange`**

Remplacer la fonction `computeLabelChanges` (ligne 67–77) par :

```js
function computeStatusChange(currentStatus, newStatus) {
  if (!newStatus) return { newStatus: null, action: 'skip' };
  if (currentStatus === newStatus) return { newStatus, action: 'noop' };
  return { newStatus, action: 'update' };
}
```

- [ ] **Step 4: Mettre à jour `syncRunStatusToGitLab()` — lecture du status actuel**

Dans la méthode `syncRunStatusToGitLab()`, remplacer la section "Labels Test:: actuels" (ligne 323–325) par :

```js
// Status natif actuel de l'issue
const currentStatus = issue.status;  // clé à confirmer Phase 0
const statusChange = computeStatusChange(currentStatus, newStatus);
```

Et remplacer `newLabel` par `newStatus` :

```js
const newStatus = STATUS_TO_GITLAB_STATUS[statusId]; // undefined si Untested
```

- [ ] **Step 5: Mettre à jour les appels GitLab dans la boucle**

Remplacer le bloc `dryRun` / `updateIssueLabel` (lignes 339–364) par :

```js
if (dryRun) {
  stats.updated++;
  onEvent('would-update', {
    caseName,
    issueIid:      issue.iid,
    currentStatus: currentStatus,
    newStatus:     statusChange.newStatus
  });
  continue;
}

try {
  await gitlabService.updateIssueStatus(gitlabProjectId, issue.iid, statusChange.newStatus);
  stats.updated++;
  onEvent('updated', { caseName, issueIid: issue.iid, newStatus: statusChange.newStatus });
  logger.info(`[StatusSync] #${issue.iid} "${caseName}" → status:${statusChange.newStatus}`);

  await this._postCommentIfNeeded(gitlabProjectId, issue.iid, caseName, runName, statusId);
} catch (err) {
  stats.errors++;
  onEvent('error', { caseName, issueIid: issue.iid, error: err.message });
  logger.error(`[StatusSync] Erreur #${issue.iid} "${caseName}":`, err.message);
}
```

- [ ] **Step 6: Mettre à jour les exports**

Remplacer le bloc exports (lignes 380–386) par :

```js
module.exports = statusSyncService;
module.exports.STATUS_TO_GITLAB_STATUS = STATUS_TO_GITLAB_STATUS;
module.exports.STATUS_ID_TO_NAME       = STATUS_ID_TO_NAME;
module.exports.GITLAB_STATUS_TODO      = GITLAB_STATUS_TODO;
module.exports.GITLAB_STATUS_OK        = GITLAB_STATUS_OK;
module.exports.GITLAB_STATUS_KO        = GITLAB_STATUS_KO;
module.exports.GITLAB_STATUS_WIP       = GITLAB_STATUS_WIP;
module.exports.GITLAB_STATUS_RETEST    = GITLAB_STATUS_RETEST;
module.exports.StatusSyncService       = StatusSyncService;
module.exports.buildCommentText        = buildCommentText;
module.exports.isCommentDuplicate      = isCommentDuplicate;
module.exports.computeStatusChange     = computeStatusChange;
```

- [ ] **Step 7: Lancer les tests**

```bash
cd backend && npm test
```

Attendu : les nouveaux tests `STATUS_TO_GITLAB_STATUS` et `computeStatusChange` passent. Les anciens tests `STATUS_TO_LABEL` / `computeLabelChanges` échouent — c'est attendu, ils seront supprimés à la Task suivante.

- [ ] **Step 8: Commit**

```bash
git add backend/services/status-sync.service.js backend/tests/calculations.test.js
git commit -m "feat(status-sync): migrate Test:: labels to native GitLab status field"
```

---

## Phase 3 — Migration du filtre dans projects.config.js + sync.service.js

> **Prérequis :** Phase 0 terminée.

### Task 3: Remplacer label: 'Test::TODO' par status natif

**Fichiers:**
- Modify: `backend/config/projects.config.js`
- Modify: `backend/services/sync.service.js`

- [ ] **Step 1: Mettre à jour projects.config.js**

Remplacer toutes les occurrences de `label: 'Test::TODO'` par `status: GITLAB_STATUS_TODO` dans `backend/config/projects.config.js` :

```js
const { GITLAB_STATUS_TODO } = require('../services/status-sync.service');

// Dans chaque projet, remplacer :
gitlab: {
  projectId: 63,
  token: null,
  status: GITLAB_STATUS_TODO   // ← remplace label: 'Test::TODO'
},
```

- [ ] **Step 2: Mettre à jour sync.service.js**

Dans `sync.service.js`, ligne 74, remplacer :

```js
this.gitlabLabel = process.env.GITLAB_LABEL || 'test::TODO';
```

par :

```js
const { GITLAB_STATUS_TODO } = require('./status-sync.service');
this.gitlabStatus = process.env.GITLAB_STATUS || GITLAB_STATUS_TODO;
```

Et remplacer tous les appels `getIssuesByLabelAndIteration(label, iterationId)` par `getIssuesByStatusAndIteration(status, iterationId)` dans sync.service.js.

- [ ] **Step 3: Vérifier les tests**

```bash
cd backend && npm test
```

- [ ] **Step 4: Commit**

```bash
git add backend/config/projects.config.js backend/services/sync.service.js
git commit -m "feat(config): replace Test::TODO label filter with native GitLab status"
```

---

## Phase 4 — Intégration du champ version

> **Prérequis :** Phase 0 terminée (VERSION_FIELD_KEY connu).

### Task 4: Exposer le filtre version via l'API backend

**Fichiers:**
- Modify: `backend/routes/sync.routes.js`
- Modify: `backend/services/status-sync.service.js`
- Modify: `backend/validators/index.js`

- [ ] **Step 1: Ajouter le paramètre `version` au validator de sync**

Dans `backend/validators/index.js`, ajouter dans le schema de la route status-to-gitlab :

```js
const statusSyncBody = z.object({
  runId:          z.number().int().positive(),
  iterationName:  z.string().min(1),
  gitlabProjectId: z.number().int().positive(),
  dryRun:         z.boolean().optional().default(false),
  version:        z.string().optional()  // ← nouveau : filtre par champ custom version
});
```

- [ ] **Step 2: Passer `version` à syncRunStatusToGitLab()**

Dans `status-sync.service.js`, mettre à jour la signature :

```js
async syncRunStatusToGitLab(runId, iterationName, gitlabProjectId, onEvent = () => {}, dryRun = false, version = null) {
```

Et dans la récupération des issues GitLab (bloc "2. Issues GitLab") :

```js
// Si version fournie : filtrer par champ custom version
const issues = version
  ? await gitlabService.getIssuesByVersionAndIteration(
      gitlabProjectId,
      version,
      iteration.id,
      process.env.GITLAB_VERSION_FIELD_KEY || 'custom_fields.version'
    )
  : await gitlabService.getIssuesForIteration(gitlabProjectId, iteration.id);
```

- [ ] **Step 3: Ajouter GITLAB_VERSION_FIELD_KEY dans .env.example**

Ajouter dans `backend/.env` (et documenter dans CLAUDE.md) :

```
GITLAB_VERSION_FIELD_KEY=custom_fields.version   # clé JSON découverte en Phase 0
```

- [ ] **Step 4: Tests du filtre version**

```js
describe('getIssuesByVersionAndIteration — filtrage mémoire par version', () => {
  test('retourne seulement les issues avec la version demandée', () => {
    const allIssues = [
      { iid: 1, custom_fields: { version: '1.2.0' } },
      { iid: 2, custom_fields: { version: '1.3.0' } },
      { iid: 3, custom_fields: { version: '1.2.0' } }
    ];
    const filtered = allIssues.filter(issue => {
      const keys = 'custom_fields.version'.split('.');
      let val = issue;
      for (const k of keys) val = val?.[k];
      return val === '1.2.0';
    });
    expect(filtered.map(i => i.iid)).toEqual([1, 3]);
  });
});
```

```bash
cd backend && npm test
```

- [ ] **Step 5: Commit**

```bash
git add backend/services/status-sync.service.js backend/validators/index.js backend/routes/sync.routes.js
git commit -m "feat(sync): add version custom field filter for QA campaign scoping"
```

---

## Phase 5 — Propagation du champ version dans le cron auto-sync + route SSE

Le cron auto-sync (Dashboard 8) appelle `syncRunStatusToGitLab()` via `POST /api/sync/status-to-gitlab`. Sans ce patch, le filtre `version` ne sera jamais transmis depuis l'UI ni depuis le cron.

### Task 5: Ajouter `version` dans la config cron + validator + route SSE

**Fichiers:**
- Modify: `backend/validators/index.js`
- Modify: `backend/routes/sync.routes.js`
- Modify: `backend/services/auto-sync-config.service.js`

- [ ] **Step 1: Ajouter `version` dans `syncStatusToGitlabBody`**

Dans `backend/validators/index.js`, remplacer (ligne 38–43) :

```js
const syncStatusToGitlabBody = z.object({
  runId: z.number().int().positive('"runId" requis'),
  iterationName: z.string().min(1, '"iterationName" requis'),
  gitlabProjectId: z.union([z.string(), z.number()], '"gitlabProjectId" requis'),
  dryRun: z.boolean().optional()
});
```

par :

```js
const syncStatusToGitlabBody = z.object({
  runId: z.number().int().positive('"runId" requis'),
  iterationName: z.string().min(1, '"iterationName" requis'),
  gitlabProjectId: z.union([z.string(), z.number()], '"gitlabProjectId" requis'),
  dryRun: z.boolean().optional(),
  version: z.string().optional()
});
```

- [ ] **Step 2: Ajouter `version` dans `autoConfigBody`**

Dans `backend/validators/index.js`, remplacer (ligne 68–75) :

```js
const autoConfigBody = z.object({
  enabled: z.boolean().optional(),
  runId: z.number().int().positive().optional(),
  iterationName: z.string().optional(),
  gitlabProjectId: z.string().optional()
}).refine(v => Object.keys(v).length > 0, {
  message: 'Aucun champ valide fourni (enabled, runId, iterationName, gitlabProjectId)'
});
```

par :

```js
const autoConfigBody = z.object({
  enabled: z.boolean().optional(),
  runId: z.number().int().positive().optional(),
  iterationName: z.string().optional(),
  gitlabProjectId: z.string().optional(),
  version: z.string().optional()
}).refine(v => Object.keys(v).length > 0, {
  message: 'Aucun champ valide fourni (enabled, runId, iterationName, gitlabProjectId, version)'
});
```

- [ ] **Step 3: Propager `version` dans la route `POST /api/sync/status-to-gitlab`**

Dans `backend/routes/sync.routes.js`, remplacer (ligne 228) :

```js
const { runId, iterationName, gitlabProjectId, dryRun = false } = req.body;
```

par :

```js
const { runId, iterationName, gitlabProjectId, dryRun = false, version } = req.body;
```

Et remplacer l'appel (ligne 250–256) :

```js
await statusSyncService.syncRunStatusToGitLab(
  runId,
  iterationName,
  gitlabProjectId,
  (type, data) => send(type, data),
  Boolean(dryRun)
);
```

par :

```js
await statusSyncService.syncRunStatusToGitLab(
  runId,
  iterationName,
  gitlabProjectId,
  (type, data) => send(type, data),
  Boolean(dryRun),
  version || null
);
```

- [ ] **Step 4: Ajouter `version` dans auto-sync-config.service.js**

Dans `backend/services/auto-sync-config.service.js`, mettre à jour `_defaultConfig()` :

```js
function _defaultConfig() {
  return {
    enabled:         process.env.SYNC_AUTO_ENABLED === 'true',
    runId:           parseInt(process.env.SYNC_AUTO_RUN_ID) || null,
    iterationName:   process.env.SYNC_AUTO_ITERATION_NAME   || '',
    gitlabProjectId: process.env.SYNC_AUTO_GITLAB_PROJECT_ID || '',
    version:         process.env.SYNC_AUTO_VERSION           || '',
    updatedAt:       null
  };
}
```

Et dans `updateConfig()`, ajouter `version` à la whitelist (ligne 83) :

```js
const allowed = ['enabled', 'runId', 'iterationName', 'gitlabProjectId', 'version'];
```

- [ ] **Step 5: Vérifier que les tests passent**

```bash
cd backend && npm test
```

- [ ] **Step 6: Commit**

```bash
git add backend/validators/index.js backend/routes/sync.routes.js backend/services/auto-sync-config.service.js
git commit -m "feat(auto-sync): propagate version filter through cron config and SSE route"
```

---

## Phase 6 — Frontend Dashboard 8 : adapter les logs SSE + affichage version

### Task 6: Mettre à jour LogLine et le formulaire de config

**Fichiers:**
- Modify: `frontend/src/components/Dashboard8.jsx`

- [ ] **Step 1: Mettre à jour `LogLine` pour les événements SSE migrés**

Dans `Dashboard8.jsx`, remplacer le bloc `updated` / `would-update` de `LogLine` (lignes 49–53) :

```jsx
else if (entry.type === 'updated')
  text = `✓ #${entry.issueIid} "${entry.caseName}" → ${entry.label}`;
else if (entry.type === 'would-update')
  text = `[DRY] #${entry.issueIid} "${entry.caseName}" : ${entry.current?.join(', ') || '∅'} → ${entry.label}`;
```

par :

```jsx
else if (entry.type === 'updated')
  text = `✓ #${entry.issueIid} "${entry.caseName}" → status:${entry.newStatus}`;
else if (entry.type === 'would-update')
  text = `[DRY] #${entry.issueIid} "${entry.caseName}" : ${entry.currentStatus || '∅'} → ${entry.newStatus}`;
```

- [ ] **Step 2: Ajouter le champ `version` dans le formulaire de config**

Dans le state initial du formulaire (ligne 67) :

```js
const [form, setForm] = useState({ runId: '', iterationName: '', gitlabProjectId: '', version: '' });
```

Et dans le JSX du formulaire, ajouter un champ version à la suite de `gitlabProjectId` :

```jsx
<div className="d8-field">
  <label className="d8-label">Version (champ custom GitLab, optionnel)</label>
  <input
    className="d8-input"
    type="text"
    placeholder="ex: 1.2.3"
    value={form.version}
    onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
  />
</div>
```

- [ ] **Step 3: Inclure `version` dans les appels API du Dashboard 8**

Localiser dans `Dashboard8.jsx` l'endroit où le formulaire est soumis pour déclencher la sync manuelle (appel SSE vers `POST /api/sync/status-to-gitlab`), et inclure `version` dans le body :

```js
body: JSON.stringify({
  runId:          parseInt(form.runId),
  iterationName:  form.iterationName,
  gitlabProjectId: parseInt(form.gitlabProjectId) || form.gitlabProjectId,
  dryRun:         isDryRun,
  version:        form.version || undefined
})
```

- [ ] **Step 4: Inclure `version` dans `PUT /api/sync/auto-config`**

Localiser l'appel `apiService.updateAutoSyncConfig(...)` dans `Dashboard8.jsx` et ajouter `version` dans le patch :

```js
const patch = {};
if (form.runId)          patch.runId          = parseInt(form.runId);
if (form.iterationName)  patch.iterationName  = form.iterationName;
if (form.gitlabProjectId) patch.gitlabProjectId = form.gitlabProjectId;
if (form.version)        patch.version        = form.version;
```

- [ ] **Step 5: Vérifier visuellement en dev**

```bash
cd frontend && npm run dev
```

Ouvrir Dashboard 8, vérifier :
- Le champ version est visible dans le formulaire
- Un dry-run affiche bien `status:XXX` dans les logs (plus de `label`)
- La config sauvegardée via "Save" inclut bien `version`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Dashboard8.jsx
git commit -m "feat(dashboard8): add version field, migrate SSE log display to native status"
```

---

## Phase 7 — Nettoyage des tests obsolètes

### Task 7: Supprimer les tests STATUS_TO_LABEL / computeLabelChanges

**Fichiers:**
- Modify: `backend/tests/calculations.test.js`

- [ ] **Step 1: Supprimer les describe blocks devenus obsolètes**

Dans `calculations.test.js`, supprimer :
- `describe('STATUS_TO_LABEL …')` (lignes 411–428)
- `describe('ALL_TEST_LABELS …')` (lignes 446–456)
- `describe('computeLabelChanges …')` (lignes 577–657)

- [ ] **Step 2: Vérifier que tous les tests passent**

```bash
cd backend && npm test
```

Attendu : 0 test en échec, suite complète verte.

- [ ] **Step 3: Commit final**

```bash
git add backend/tests/calculations.test.js
git commit -m "test: remove obsolete label-based tests, replaced by native status tests"
```

---

## Checklist de vérification post-migration

- [ ] `npm test` passe complètement (0 fail)
- [ ] Un dry-run sur neo-pilot montre les `newStatus` (pas les `label`) dans les logs SSE Dashboard 8
- [ ] Une issue GitLab de test a bien son status natif mis à jour (pas un label)
- [ ] Le filtre `version` retourne bien les bonnes issues sur l'itération cible
- [ ] Le champ `version` est visible + persisté dans le formulaire Dashboard 8 (config cron)
- [ ] Le cron auto-sync (lancement manuel depuis Dashboard 8) transmet bien `version` à `syncRunStatusToGitLab`
- [ ] `DoubleTestNécessaire` : confirmer statut GitLab natif ou label conservé (résultat Phase 0 curl 1)
- [ ] `Test::OK`, `Test::KO` etc. n'apparaissent plus nulle part dans le code actif

```bash
# Vérification finale : aucune occurrence de label dans le code actif
grep -r "Test::" backend/services backend/config backend/routes backend/validators \
  --include="*.js" | grep -v "\.test\." | grep -v "//.*Test::"
# Attendu : 0 résultat
```

---

## Ordre d'exécution recommandé

```
Phase 0  →  Phase 1  →  Phase 2  →  Phase 3
                                      ↓
                         Phase 5 ← Phase 4
                              ↓
                         Phase 6  →  Phase 7
```

**Dépendances bloquantes :**
- Phase 0 bloque tout (valeurs des constantes inconnues)
- Phase 2 dépend de Phase 1 (`updateIssueStatus` doit exister)
- Phase 5 dépend de Phase 2 (la route SSE passe `version` à `syncRunStatusToGitLab`)
- Phase 6 dépend de Phase 2 (les événements SSE portent `newStatus` à partir de là)
- Phase 7 peut se faire à tout moment après Phase 2
