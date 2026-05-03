---
name: qa-status-sync
description: Sync Testmo → GitLab Work Item Status (neo-pilot + workshop-web)
schedule: Jours ouvrés 10:00 ET 13:30 (Europe/Paris)
type: À distance (serveurs Anthropic)
---

# Routine A — Sync Testmo → GitLab Status

> **Usage** : copier le prompt ci-dessous dans une nouvelle routine "À distance" dans l'app Claude Desktop.
> Remplacer les 2 valeurs `[...]` par celles du fichier `backend/.env` avant de sauvegarder.
> Créer 2 routines avec ce même prompt : une à 10h00, une à 13h30.

---

## PROMPT À COPIER-COLLER

```
Tu es un agent QA automatique. Synchronise les statuts de tests depuis Testmo vers les Work Items GitLab pour les projets neo-pilot et workshop-web.

## CREDENTIALS
TESTMO_URL = "https://neo-logix.testmo.net"
TESTMO_TOKEN = "[VALEUR DE TESTMO_TOKEN DANS backend/.env]"
GITLAB_URL = "https://gitlab.neo-logix.fr"
GITLAB_WRITE_TOKEN = "[VALEUR DE GITLAB_WRITE_TOKEN DANS backend/.env]"

## MAPPING STATUTS (confirmé en production)
- 2 (Passed) → gid://gitlab/WorkItems::Statuses::Custom::Status/18  (Test OK)
- 3 (Failed) → gid://gitlab/WorkItems::Statuses::Custom::Status/17  (Test KO)
- 4 (Retest) → gid://gitlab/WorkItems::Statuses::Custom::Status/19  (Test Blocked)
- 8 (WIP)    → gid://gitlab/WorkItems::Statuses::Custom::Status/21  (Test WIP)
- Autres     → ignorer

## PROJETS
1. neo-pilot    : Testmo projectId=1,  GitLab projectId=63
2. workshop-web : Testmo projectId=10, GitLab projectId=141

## MISSION

Écris un script Node.js dans /tmp/qa-status-sync.js (module https natif uniquement, pas de npm) puis exécute-le avec `node /tmp/qa-status-sync.js`.

Le script effectue pour chaque projet :

### Étape 1 — Run Testmo le plus récent
GET https://neo-logix.testmo.net/api/v1/projects/{testmoProjectId}/runs
Header: Authorization: Bearer {TESTMO_TOKEN}
→ Trier par created_at décroissant, prendre le 1er.
→ Extraire : id (runId) et name (runName, ex: "R10 - run 1")

### Étape 2 — Résultats du run (toutes les pages)
GET https://neo-logix.testmo.net/api/v1/runs/{runId}/results?page=N
→ Paginer tant que next_page existe et que data n'est pas vide.
→ Garder uniquement is_latest === true.
→ Si case_name absent : résoudre via GET /api/v1/projects/{testmoProjectId}/cases?page=N

### Étape 3 — Itération GitLab correspondante
GET https://gitlab.neo-logix.fr/api/v4/projects/{gitlabProjectId}/iterations?search={runName}&state=all
Header: PRIVATE-TOKEN: {GITLAB_WRITE_TOKEN}
→ Trouver l'itération dont le title === runName.
→ Si aucune : logger un warning et passer au projet suivant.

### Étape 4 — Issues GitLab de l'itération
GET https://gitlab.neo-logix.fr/api/v4/projects/{gitlabProjectId}/issues?iteration_id={iterationId}&state=all&scope=all&per_page=100
→ Gérer la pagination via le header Link: rel="next".
→ Indexer par title.toLowerCase().trim().

### Étape 5 — Mise à jour Work Item status (GraphQL)
Pour chaque résultat Testmo avec status_id mappé (2/3/4/8) :
1. Trouver l'issue GitLab : title.toLowerCase().trim() === case_name.toLowerCase().trim()
2. GID = "gid://gitlab/WorkItem/" + issue.id  (id global REST, PAS l'iid)
3. POST https://gitlab.neo-logix.fr/api/graphql
   Headers: PRIVATE-TOKEN: {GITLAB_WRITE_TOKEN}, Content-Type: application/json
   Body: {
     "query": "mutation UpdateStatus($id: WorkItemID!, $statusId: WorkItemsStatusesStatusID!) { workItemUpdate(input: { id: $id statusWidget: { status: $statusId } }) { workItem { id } errors } }",
     "variables": { "id": "{workItemGid}", "statusId": "{statusGid}" }
   }
4. Attendre 400ms entre chaque appel GitLab.
5. Si errors dans la réponse GraphQL : logger et continuer.

### Étape 6 — Rapport
✅ neo-pilot (run "...") : updated=X skipped=Y errors=Z
✅ workshop-web (run "...") : updated=X skipped=Y errors=Z
Si errors > 0 : lister les issues concernées avec le message d'erreur.
```
