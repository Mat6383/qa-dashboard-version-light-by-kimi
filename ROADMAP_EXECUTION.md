# Roadmap d'exécution — Améliorations QA Dashboard

Basé sur le plan : `docs/superpowers/plans/2026-05-12-qa-dashboard-improvements.md`

## Progression

| #   | Tâche                                                    | Statut  | Commit  |
| --- | -------------------------------------------------------- | ------- | ------- |
| 1   | Documenter `frontend/src/server/` comme type-only legacy | ✅ Fait | dc25191 |
| 2   | Documenter mappings Testmo status IDs                    | ✅ Fait | 2d5ff24 |
| 3   | Splitter `trpc.py` en domain routers                     | ✅ Fait | ef475dd |
| 4   | Ajouter tests d'intégration API (tRPC)                   | ✅ Fait | c3ce89f |
| 5   | Compléter pre-commit hooks avec ruff                     | ✅ Fait | a635573 |
| 6   | Docker Compose global — Makefile + .dockerignore backend | ✅ Fait | —       |
| 7   | Splitter TestmoService (client + metrics)                | ✅ Fait | —       |
| 8   | Health check complet (Testmo/GitLab, DB, disk, CB, 503)  | ✅ Fait | —       |

---

## Résumé des modifications

### T1 — `frontend/src/server/` type-only legacy

- Ajout de `frontend/src/server/README.md` expliquant que le dossier est legacy type-only
- Mise à jour du commentaire dans `frontend/src/trpc/client.ts`
- **Note** : suppression complète bloquée par le type `AppRouter` utilisé par `createTRPCReact`. Nécessite un type stub ou une migration OpenAPI.

### T2 — Documentation Testmo status IDs

- Commentaires ajoutés dans `backend_py/app/services/testmo.py` aux lignes ~223 et ~287
- Mapping documenté : status1=Passed, status2=Failed, status3=Retest, status4=Blocked, status5=Skipped, status7=WIP

### T3 — Split `trpc.py`

- `backend_py/app/routers/trpc/` créé avec 13 modules domaine + `_common.py`
- `trpc.py` réduit de 851 à ~76 lignes (agrégateur uniquement)
- 4 commits : `_common.py` + `__init__.py`, puis domaines par lots, puis réécriture de l'agrégateur
- 209 tests passent, ruff OK

### T4 — Tests d'intégration tRPC

- 3 tests ajoutés dans `backend_py/tests/test_routers_integration.py::TestTrpcRouter`
  - `test_trpc_unknown_procedure_returns_not_found`
  - `test_trpc_dashboard_metrics`
  - `test_trpc_batch_get_dashboard`
- 212 tests passent au total

### T5 — Pre-commit hooks ruff

- `package.json` mis à jour : `backend_py/**/*.py` ajouté à `lint-staged`
- Commandes : `ruff check --fix` puis `ruff format`
- Testé avec succès sur un fichier scratch

### T6 — Docker Compose global (Makefile + .dockerignore)

- **`Makefile`** créé à la racine avec les cibles :
  - `make dev` / `make dev-detach` — démarrage dev avec hot-reload
  - `make prod` — démarrage production
  - `make stop` / `make clean` — arrêt et nettoyage
  - `make logs` / `make logs-prod` — logs temps réel
  - `make test` / `make test-backend` — tests backend + frontend
  - `make lint` / `make lint-backend` / `make lint-frontend` — linting
  - `make build` — build images production
  - `make ps` / `make shell-backend` / `make shell-frontend` — introspection
- **`backend_py/.dockerignore`** créé (manquant) — exclut `.venv`, `__pycache__`, `db-data/`, `logs/`, `tests/`, etc.

---

### T7 — Splitter TestmoService

- **`testmo_client.py`** — `TestmoClient` : HTTP, cache, circuit breaker, CRUD
  projects/runs/cases/folders/automation
- **`testmo_metrics.py`** — `TestmoMetrics(client)` : KPIs (`get_project_metrics`),
  SLA (`_check_sla`), trends (`get_annual_quality_trends`), escape/detection rates,
  `compare_projects`
- **`testmo.py`** — `TestmoService(TestmoClient)` façade avec `__getattr__` vers
  `TestmoMetrics`
  - Zéro changement dans les 15+ fichiers qui importent `testmo_service`
  - Tests existants passent (211/212, 1 flaky préexistant sur DB SQLite concurrente)

---

### T8 — Health check complet

- **`/api/health/ready`** — probe Kubernetes-style :
  - Vérifie `main_db` et `comments_db` avec `SELECT 1`
  - Retourne **503** si une DB critique est down
- **`/api/health/detailed`** — rapport complet monitoring :
  - Ping **Testmo** (timeout 5s) + **GitLab** (timeout 5s)
  - Check DB + **disk usage** (WARNING si > 90 %)
  - État des **circuit breakers**
  - Statut global : `OK` / `DEGRADED` / `DOWN`
- Tests existants passent sans modification

---

_Dernière mise à jour : 2026-05-12_
