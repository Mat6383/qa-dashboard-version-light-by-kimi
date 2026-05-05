# Plan d'implémentation — P31 : Sync GitLab → Testmo Cases

> **Date** : 2026-05-04  
> **Pivot** : P30 (Automation Runs) est métier-incorrect car l'API Testmo ne permet pas d'écrire sur les runs manuels. P31 cible le **référentiel de cases** (CRUD complet via API).  
> **Référence** : Routine B documentée dans `docs/routines/routine-B-gitlab-to-testmo.md`, portée depuis `backend/services/sync.service.ts` (Node.js legacy).

---

## Objectif

Intégrer la logique de synchronisation des **cases Testmo** depuis les issues GitLab dans le backend Python (`backend_py/`). Le frontend pivote du wording "Run" vers "Cases".

---

## Architecture cible

```
backend_py/app/services/
├── testmo.py              ← étendu : case repository + folder ops
├── gitlab.py              ← ✅ déjà complet
├── sync.py                ← étendu : preview + execute cases
├── case_sync.py           ← NOUVEAU : orchestration case sync (Routine B)
└── sync_mapper.py         ← étendu : build_case_payload + extract_steps

frontend/src/components/
└── Dashboard6.tsx         ← pivot wording "Run" → "Cases", retrait section UI Automation
```

---

## Tickets d'implémentation

### 🔴 P31#1 — Testmo Case Repository (backend_py)

**Fichier** : `backend_py/app/services/testmo.py`

Ajouter les méthodes de repository manquantes (actuellement seuls les automation runs sont supportés) :

| Méthode                                             | Endpoint                                  | Description                               |
| --------------------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| `get_cases(project_id, folder_id, per_page)`        | `GET /projects/{id}/cases`                | Pagination complète                       |
| `find_case_by_name(project_id, name, folder_id)`    | `GET /projects/{id}/cases` + filtre local | Match exact `case.name === name`          |
| `create_cases(project_id, cases)`                   | `POST /projects/{id}/cases`               | Batch creation (body: `{ cases: [...] }`) |
| `update_case(project_id, case_id, case_data)`       | `PUT /projects/{id}/cases/{id}`           | Mise à jour unitaire                      |
| `get_folders(project_id, parent_id)`                | `GET /projects/{id}/folders`              | Liste des dossiers                        |
| `create_folder(project_id, name, parent_id)`        | `POST /projects/{id}/folders`             | Création dossier                          |
| `get_or_create_folder(project_id, name, parent_id)` | —                                         | Idempotence find-then-create              |

**Contraintes** :

- Réutiliser le client `httpx.AsyncClient` existant
- Conserver le circuit breaker + retry (`@with_resilience`)
- Pas de cache TTL sur les cases (données mutables)

**Tests** : `backend_py/tests/test_testmo_cases.py` — mocks httpx + assertions CRUD.

---

### 🔴 P31#2 — Extraction des steps GitLab

**Fichier** : `backend_py/app/services/sync_mapper.py` (nouveau module `case_sync_mapper.py` si trop gros)

Porter l'algorithme `_extractStepsFromNotes()` depuis `backend/services/sync.service.ts:136-182` :

1. **Regex labels** : `r'\[([^\]]+)\](?!\()'` — exclure les liens markdown `[text](url)`.
2. **Pool non-TEST** (`[PRÉREQUIS]`, `[CONTEXTE]`, `[IMPACT]`…) :  
   Prendre depuis la **note la plus longue** (`max(notes, key=lambda n: len(n.body))`), ordre d'apparition préservé.
3. **Pool TEST** (`[TEST]`, `[TESTS]`, case-insensitive) :  
   Collecter depuis **toutes les notes** en ordre chronologique (`sort=asc`).
4. **Ordre final** : non-TEST first, puis TEST.
5. **HTML rendering** : convertir chaque section en HTML via `markdown` (ou `mistune`)  
   Template : `<p><strong>[{label}]</strong></p>\n<p>{content}</p>`

**Payload Testmo step** :

```python
{
  "text1": "<p><strong>[TEST]</strong></p><p>Contenu...</p>",
  "text3": "<p>Conforme aux specs fonctionnelles</p>",
  "display_order": i + 1
}
```

**Edge cases à couvrir** (reprendre les 15 cas de `backend/tests/calculations/steps.test.ts`) :

- Markdown links ne créent pas de faux steps
- Note mixte (non-TEST + TEST) contribue aux deux pools
- `[TESTS]` (plural) traité comme `[TEST]`
- Absence de notes → `custom_steps` absent du payload

**Tests** : `backend_py/tests/test_steps_extraction.py` — 15+ cas.

---

### 🔴 P31#3 — Case Sync Orchestration

**Fichier** : `backend_py/app/services/case_sync.py` (NOUVEAU)

Méthode principale : `sync_iteration(project_id, iteration_name, options)` :

```python
async def sync_iteration(
    gitlab_project_id: int,
    testmo_project_id: int,
    iteration_name: str,
    label: str = "Test::TODO",
    root_folder_id: int = 4514,
    dry_run: bool = False,
) -> SyncCaseResult:
```

**Pipeline** :

1. **Find iteration** — `gitlab.find_iteration(gitlab_project_id, iteration_name)`
2. **Fetch issues** — `gitlab.get_issues_by_label_and_iteration(...)` (paginé)
3. **Folder hierarchy** — Parser `iteration_name` (ex: `"R06 - run 1"` → parent `"R06"`, child `"R06 - run 1"`).  
   Créer via `testmo.get_or_create_folder()` sous `root_folder_id`.  
   _Mode test_ : préfixer `[TEST-API]` au nom du dossier.
4. **Fetch existing cases** — `testmo.get_cases(testmo_project_id, folder_id)` + index `name → case`
5. **For each issue** :
   - **Match** : `existing = cases_by_name.get(issue.title)`
   - **Enrichment guard** : si `existing` et `is_case_enriched(existing)` → skip (count `unchanged`)
   - **Build payload** : `build_case_payload(issue, notes, folder_id)`
   - **Create** ou **Update** via Testmo API
   - **Label GitLab** : ajouter `Sync-Updated` si créé/mis à jour
   - **Delay** : `await asyncio.sleep(0.3)` entre appels (rate-limiting)
6. **Return stats** : `{ created, updated, skipped, errors, details[] }`

**Enrichment check** (`is_case_enriched`) :

- `estimate > 0`
- `issues` non vide
- Tags manuels (pas `gitlab-*`, `iteration-*`, `sync-auto`)
- `custom_priority != "Normal"`
- `attachments` non vides
- `custom_steps` avec `text1` non vide

**Preview** : `preview_sync_iteration(...)` — même pipeline mais sans écriture API, retourne le dry-run.

**Tests** : `backend_py/tests/test_case_sync.py` — mocks complet GitLab + Testmo, assertions sur stats.

---

### 🟠 P31#4 — API REST & tRPC

**Fichiers** : `backend_py/app/routers/sync.py`, `backend_py/app/routers/trpc_bridge.py`

**REST** — étendre le router sync existant :

| Endpoint                  | Méthode | Description                                                         |
| ------------------------- | ------- | ------------------------------------------------------------------- |
| `/api/sync/cases/preview` | `POST`  | Dry-run case sync. Body: `{ projectId, iterationName, label? }`     |
| `/api/sync/cases/execute` | `POST`  | **SSE stream** (same pattern as `/api/sync/execute`). Body: same    |
| `/api/sync/cases/history` | `GET`   | Historique des sync cases (reuse `SyncRun` model ou nouvelle table) |

**tRPC bridge** — ajouter les procédures :

- `sync.previewCases`
- `sync.executeCases`

**SSE events** (même format que P30 pour compatibilité Dashboard6) :

```json
{ "type": "progress", "current": 5, "total": 42, "action": "creating_case", "issue": "#123" }
{ "type": "complete", "stats": { "created": 3, "updated": 2, "skipped": 1, "errors": 0 } }
{ "type": "error", "message": "..." }
```

---

### 🟠 P31#5 — Frontend Dashboard6 Pivot

**Fichier** : `frontend/src/components/Dashboard6.tsx`

**Changements de wording** (Run → Cases) :

- `title="Nom de la source d'automatisation dans Testmo"` → retirer "d'automatisation"
- `Run Testmo :` → `Dossier Testmo :`
- `Ouvrir le run Testmo →` → `Ouvrir le dossier Testmo →`
- `Run manuel Testmo (UI Automation)` → **supprimer toute la section** (P30 obsolete)
- `Run créé` / `Créer run manuel` / `Mettre à jour résultats` → supprimer

**Preview** :

- Remplacer `preview.target_run` par `preview.target_folder` (nom + id du dossier Testmo cible)
- Les chips `à créer / à mettre à jour / inchangés` restent valides

**Execute** :

- Le bouton `Confirmer et Synchroniser` conserve son libellé
- Le SSE parser reste compatible (mêmes events `progress` / `complete`)

**State machine** : inchangée (`idle | analyzing | preview | syncing | done`)

**Tests** : adapter `frontend/src/components/__tests__/Dashboard6.test.tsx` (ou créer si absent).

---

### 🟡 P31#6 — Auto-Sync Job

**Fichier** : `backend_py/app/jobs/auto_sync.py`

Brancher le job auto-sync existant sur la nouvelle pipeline case sync :

- Si `auto_config.mode == "cases"` (nouveau champ) → appeler `case_sync.sync_iteration()`
- Si `auto_config.mode == "automation"` → conserver l'ancien `sync.execute_sync()` (rétro-compatibilité)
- Défaut : `"cases"`

Migration DB Alembic : ajouter colonne `mode` (str, default `"cases"`) sur `auto_sync_config`.

---

### 🟡 P31#7 — Persistance & Traçabilité

**Fichier** : `backend_py/app/models/sync_history.py`

Étendre `SyncRun` (ou créer `SyncCaseRun`) :

```python
class SyncCaseRun(Base):
    __tablename__ = "sync_case_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int]
    iteration_name: Mapped[str]
    folder_id: Mapped[int | None]
    folder_url: Mapped[str | None]
    stats_created: Mapped[int] = mapped_column(default=0)
    stats_updated: Mapped[int] = mapped_column(default=0)
    stats_skipped: Mapped[int] = mapped_column(default=0)
    stats_errors: Mapped[int] = mapped_column(default=0)
    details: Mapped[list[dict]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
```

Route `/api/sync/cases/history` expose cette table.

---

### 🟢 P31#8 — Cleanup P30 (Automation Runs)

**Décision** : garder le code P30 en mode **deprecated** mais fonctionnel (pas de suppression immédiate).

Actions :

- [ ] Ajouter un champ `mode` dans l'UI auto-sync (`cases` | `automation`)
- [ ] Logger un `warnings.warn("Automation run sync is deprecated, prefer case sync", DeprecationWarning)` côté Python si mode=automation
- [ ] Dashboard6 : masquer (commenter) la section "Run manuel Testmo (UI Automation)" — pas supprimer pour rollback facile

---

## Dépendances & Ordre d'implémentation

```
P31#1 (Testmo Repository)
    ↓
P31#2 (Steps Extraction)
    ↓
P31#3 (Case Sync Orchestration) ← dépend de #1 et #2
    ↓
P31#7 (Persistance DB) ← peut être fait en parallèle de #1-#3
    ↓
P31#4 (API REST/tRPC) ← dépend de #3 et #7
    ↓
P31#5 (Frontend Pivot) ← dépend de #4 (mêmes endpoints)
    ↓
P31#6 (Auto-Sync Job) ← dépend de #3 et #7
    ↓
P31#8 (Cleanup P30) ← dernier
```

---

## Indicateurs de succès

| Métrique             | Cible                                                 |
| -------------------- | ----------------------------------------------------- |
| Tests backend Python | +40 tests (steps extraction + case sync + repository) |
| Couverture case sync | ≥ 80 % statements                                     |
| TypeCheck Python     | 0 erreur mypy                                         |
| Build frontend       | ✅ (< 3s)                                             |
| TypeCheck frontend   | 0 erreur TS                                           |
| Dashboard6 LOC       | ≤ 900 (retrait section UI Automation)                 |
| End-to-end           | 1 itération réelle syncée GitLab → Testmo cases       |

---

## Risques & Mitigations

| Risque                               | Mitigation                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| API Testmo case PUT change de format | Lire la doc officielle avant #1 ; tests d'intégration réels sur sandbox          |
| Markdown parser Python ≠ marked.js   | Valider le rendu HTML des steps côte-à-côte (Node vs Python) sur 5 cas réels     |
| Performance : paginer 10k+ cases     | Index mémoire `dict[name]` après un seul fetch paginé ; Testmo limite à 100/page |
| Folder hierarchy deep nesting        | Limiter à 2 niveaux (parent=release, child=iteration) comme Routine B actuelle   |

---

## Références

- `docs/routines/routine-B-gitlab-to-testmo.md` — spec originale Routine B
- `backend/services/sync.service.ts` — implémentation Node.js legacy (721 LOC)
- `backend/services/testmo/repository.ts` — Testmo repository Node.js
- `backend/tests/calculations/steps.test.ts` — 15 cas de test steps
- `backend_py/app/services/sync.py` — sync Python actuel (automation runs)
- `backend_py/app/services/testmo.py` — Testmo client Python actuel
