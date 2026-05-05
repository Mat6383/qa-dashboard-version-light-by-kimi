# Routine E2E — Test réel Cases Sync (GitLab → Testmo)

> **Objectif** : Valider le flow Cases Sync de bout en bout avec des **vraies API externes** (GitLab + Testmo).  
> **Scope** : P31 — Synchronisation des issues GitLab vers le référentiel de cases Testmo.  
> **Prérequis** : Accès à une instance GitLab avec des issues labellisées + instance Testmo avec un projet cible.

---

## 🔧 Préparation

### 1. Environnement

```bash
# Démarrer le backend Python en mode dev (pas de mock)
cd backend_py
source .venv/bin/activate
uvicorn app.main:app --reload --port 3001

# Vérifier la connexion
python -c "
import asyncio
from app.services.gitlab import gitlab_service
from app.services.testmo import testmo_service
async def check():
    print('GitLab:', await gitlab_service.get_projects())
    print('Testmo:', await testmo_service.get_projects())
asyncio.run(check())
"
```

### 2. Variables d'environnement requises

```env
TESTMO_URL=https://votre-instance.testmo.net
TESTMO_TOKEN=your_token_here
TESTMO_PROJECT_ID=123

GITLAB_URL=https://gitlab.votre-instance.fr
GITLAB_TOKEN=your_read_token
GITLAB_WRITE_TOKEN=your_write_token
GITLAB_PROJECT_ID=141
```

### 3. Préparer les données de test sur GitLab

1. **Créer une itération** (ou utiliser une existante) : ex. `R99 - E2E Test`
2. **Créer 3-5 issues** avec :
   - Label `Test::TODO` (ou celui configuré)
   - Champ **Version de test** = `R99 - E2E Test`
   - Notes contenant des sections `[TEST]`, `[PRÉREQUIS]`, `[CONTEXTE]`
3. **S'assurer qu'au moins une issue** a le statut "Test TODO" (pas "OK")

---

## 🚀 Scénario de test

### Étape 1 — Lister les projets sync

```bash
curl -s http://localhost:3001/api/sync/projects | jq .
```

**Attendu** : Retourne la liste des projets configurés dans `app/projects_config.py`.

```json
{
  "success": true,
  "data": [{ "id": "workshop-web", "label": "Workshop Web", "configured": true }]
}
```

---

### Étape 2 — Lister les itérations

```bash
curl -s "http://localhost:3001/api/sync/workshop-web/iterations?search=R99" | jq .
```

**Attendu** : Retourne l'itération `R99 - E2E Test` si elle existe dans GitLab.

```json
{
  "success": true,
  "data": [{ "id": 12345, "title": "R99 - E2E Test" }]
}
```

---

### Étape 3 — Preview (dry-run)

```bash
curl -s -X POST http://localhost:3001/api/sync/cases/preview \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "workshop-web",
    "iteration_name": "R99 - E2E Test",
    "label": "Test::TODO",
    "root_folder_id": 4514
  }' | jq .
```

**Attendu** :

- `folder.exists` : `true` si le dossier existe déjà dans Testmo, `false` sinon
- `issues` : liste des issues mappées avec statut `create`, `update` ou `skip`
- `summary.total` > 0 (si des issues correspondent)

```json
{
  "success": true,
  "data": {
    "iteration": { "name": "R99 - E2E Test" },
    "folder": { "parent": "R99", "child": "R99 - E2E Test", "exists": false },
    "issues": [
      { "iid": 1001, "title": "[TEST] Feature X", "status": "create" },
      { "iid": 1002, "title": "[TEST] Feature Y", "status": "create" }
    ],
    "summary": { "toCreate": 2, "toUpdate": 0, "toSkip": 0, "total": 2 }
  }
}
```

---

### Étape 4 — Exécution (SSE stream)

```bash
curl -N -X POST http://localhost:3001/api/sync/cases/execute \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "workshop-web",
    "iteration_name": "R99 - E2E Test",
    "label": "Test::TODO",
    "root_folder_id": 4514,
    "dry_run": false
  }'
```

**Attendu** : Stream SSE avec les événements :

```
data: {"level": "info", "message": "Starting case sync for iteration R99 - E2E Test"}

data: {"level": "debug", "message": "CREATE: [TEST] Feature X"}

data: {"level": "debug", "message": "CREATE: [TEST] Feature Y"}

data: {"level": "done", "created": 2, "updated": 0, "skipped": 0, ...}
```

**Vérification côté Testmo** :

- Se connecter à l'UI Testmo
- Naviguer vers le projet → Cases
- Vérifier que le dossier `R99 - E2E Test` existe
- Vérifier que les cases ont été créées avec les bons titres et steps

---

### Étape 5 — Vérification de l'historique

```bash
curl -s http://localhost:3001/api/sync/cases/history | jq .
```

**Attendu** : Le dernier run apparaît dans l'historique avec les bonnes stats.

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "project_id": 141,
      "iteration_name": "R99 - E2E Test",
      "stats_created": 2,
      "stats_updated": 0,
      "stats_skipped": 0,
      "stats_errors": 0,
      "created_at": "2026-05-05T08:30:00"
    }
  ]
}
```

---

### Étape 6 — Vérification côté GitLab (labels mis à jour)

Les issues synchronisées doivent avoir reçu le label `Sync-Updated`.

```bash
# Via API GitLab
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/projects/141/issues?labels=Sync-Updated" | jq '.[].iid'
```

**Attendu** : Les IIDs des issues créées/mises à jour apparaissent.

---

## ♻️ Cleanup (important)

Après le test, nettoyer les données pour éviter de polluer l'instance Testmo :

1. **Supprimer le dossier Testmo** créé pour le test (manuellement dans l'UI ou via API si supporté)
2. **Retirer le label `Sync-Updated`** des issues GitLab de test
3. **Supprimer l'entrée d'historique** si nécessaire :
   ```bash
   sqlite3 backend_py/db-data/sync-history.db "DELETE FROM sync_case_runs WHERE iteration_name = 'R99 - E2E Test';"
   ```

---

## ⚠️ Points d'attention

| Risque                | Mitigation                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Rate-limiting Testmo  | Le service inclut un `await asyncio.sleep(0.3)` entre appels. Ne pas lancer plusieurs sync en parallèle.              |
| Dossier déjà existant | Si le dossier existe, les cases seront mises à jour (`update`) au lieu de créées. Vérifier `preview.folder.exists`.   |
| Enrichment guard      | Si une case a déjà des steps, des tags manuels ou des attachments, elle sera skip. Vérifier `preview.summary.toSkip`. |
| Token GitLab write    | Le label `Sync-Updated` nécessite `GITLAB_WRITE_TOKEN`. Vérifier qu'il est configuré.                                 |

---

## 🐛 Bugs rencontrés et corrigés lors de l'exécution

> **Date d'exécution** : 2026-05-05  
> **Itérations testées** :
>
> - `neo-pilot` → `R14 - run 2` (11 issues, 3 créées, 8 skippées)
> - `workshop-web` → `Itération #24 (04/05 → 17/05)` (15 issues, 14 créées, 1 skippée)
>   **Résultat final** : ✅ Tous les scénarios passent  
>   **Cases migrées vers format `[#iid]`** : 15 cases workshop-web mises à jour en direct

### Bug 1 — Champ `description` invalide (422 Unprocessable Content)

**Symptôme** : L'API Testmo retournait `422 Unprocessable Content` sur `POST /api/v1/projects/{id}/cases`.

**Cause** : Le payload envoyait le champ `description` au lieu de `custom_description`. L'API Testmo v1 n'accepte que les champs custom préfixés par `custom_`.

**Correction** : `backend_py/app/services/case_sync.py:94`

```python
# AVANT ❌
payload["description"] = truncated

# APRÈS ✅
payload["custom_description"] = truncated
```

### Bug 2 — Tags avec espaces rejetés par Testmo

**Symptôme** : Même après correction du bug 1, l'API retournait `422` avec le message :
`"The cases.0.tags field contains one or more invalid tag names."`

**Cause** : Le tag `iteration-R14 - run 2` contenait des espaces, que l'API Testmo rejette.

**Correction** : `backend_py/app/services/case_sync.py:81-86`

```python
# AVANT ❌
tags = [
    "gitlab-sync",
    f"gitlab-{gitlab_project_id}-{iid}",
    f"iteration-{iteration_name}",
]

# APRÈS ✅
def _sanitize_tag(tag: str) -> str:
    import re
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", tag)

tags = [
    "gitlab-sync",
    _sanitize_tag(f"gitlab-{gitlab_project_id}-{iid}"),
    _sanitize_tag(f"iteration-{iteration_name}"),
]
```

### Bug 3 — `title=null` pour les cadences automatiques GitLab

**Symptôme** : Le dropdown des itérations pour `workshop-web` affichait des entrées vides (toutes avec `title: null`).

**Cause** : Les itérations générées automatiquement par GitLab n'ont pas de champ `title`. Le backend Python ne générait pas de fallback.

**Correction** : `backend_py/app/services/sync.py:44` + `backend_py/app/services/gitlab.py`

```python
# AVANT ❌
"title": it.get("title"),

# APRÈS ✅
title = it.get("title")
if not title:
    iid = it.get("iid") or it.get("sequence") or it.get("id")
    title = f"Itération #{iid} ({_fmt_date(it.get('start_date'))} → {_fmt_date(it.get('due_date'))})"
```

### Bug 4 — `find_iteration` ne gérait pas les cadences auto

**Symptôme** : Le preview/execute pour `workshop-web` retournait `Iteration not found` car `find_iteration` ne trouvait jamais l'itération (match par `title` uniquement).

**Cause** : `find_iteration` faisait un match par titre normalisé, mais `title` était `null`. L'ancien backend Node.js utilisait `findIterationForProject` qui matchait aussi par `iid`.

**Correction** : Fusion de `find_iteration` dans `find_iteration_for_project` avec match par `iid` + fallback title. Fichiers : `gitlab.py`, `case_sync.py`, `sync.py`.

### Bug 5 — Mauvais `testmo_project_id` (projet 1 au lieu de 10)

**Symptôme** : Le sync pour `workshop-web` tentait de créer des dossiers/cases dans le **projet Testmo 1** (neo-pilot) au lieu du **projet 10** (workshop-web).

**Cause** : Le route utilisait `settings.testmo_project_id` (valeur globale = 1) au lieu du `testmo.projectId` configuré dans `projects_config.py`.

**Correction** : `backend_py/app/projects_config.py` + `backend_py/app/routers/sync.py`

```python
# AVANT ❌
testmo_project_id=payload.testmo_project_id or settings.testmo_project_id,

# APRÈS ✅
testmo_project_id=payload.testmo_project_id or resolve_testmo_project_id(payload.project_id) or settings.testmo_project_id,
```

### Bug 6 — Tags avec caractères spéciaux rejetés par Testmo

**Symptôme** : Après correction des bugs 1-2, le sync sur `workshop-web` retournait encore `422` : `"The cases.0.tags field contains one or more invalid tag names."`

**Cause** : Le titre fallback `Itération #24 (04/05 → 17/05)` générait des tags contenant `(`, `)`, `#`, `→` — tous rejetés par Testmo.

**Correction** : Sanitize plus agressif dans `case_sync.py:81`

```python
# AVANT ❌ (insuffisant)
def _sanitize_tag(tag: str) -> str:
    return tag.replace(" ", "_").replace("/", "_")

# APRÈS ✅
def _sanitize_tag(tag: str) -> str:
    import re
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", tag)
```

---

## ✅ Checklist de validation

- [x] Projet configuré retourné par `/sync/projects`
- [x] Itération trouvée par `/sync/{id}/iterations`
- [x] Preview retourne `total > 0`
- [x] Execute SSE stream termine sans erreur (`level: done`)
- [x] Cases visibles dans l'UI Testmo (bon dossier, bons titres)
- [x] Steps extraits correctement depuis les notes GitLab
- [x] Historique persisté dans `/sync/cases/history`
- [x] Labels GitLab mis à jour (`Sync-Updated`)
- [x] Cleanup effectué (N/A — cases légitimes d'une itération réelle)
