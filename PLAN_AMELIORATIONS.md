# Plan d'amelioration -- QA Dashboard

## PRIORITE 1 -- Architecture codebase

### 1.1 Splitter `TestmoService` (837 lignes)

**Fichier actuel** : `backend_py/app/services/testmo.py`

**Problem** : Un seul fichier cumule client API HTTP, cache, circuit breaker, calculs metriques ISTQB, aggregation, detection SLA.

**Solution** : 3 fichiers separes

```
backend_py/app/services/
  testmo_client.py   # Appels HTTP, pagination, retry, circuit breaker
  testmo_cache.py    # Cache, dedup, invalidation
  testmo_metrics.py  # Calculs ISTQB, SLA, aggregation de sessions
```

Chaque composant est testable independamment. Le `testmo_client` expose une interface propre : `get_runs()`, `get_sessions()`, `get_cases()`. Le `testmo_metrics` compose ces appels pour produire les dashboard metrics.

### 1.2 Splitter `trpc.py` (849 lignes)

**Fichier actuel** : `backend_py/app/routers/trpc.py`

**Problem** : Un seul router traduit toutes les requetes tRPC batch (15+ procedures). Difficile a maintenir et debugger.

**Solution** : Split par domaine fonctionnel

```
backend_py/app/routers/trpc/
  __init__.py        # Router principal qui mount les sous-routers
  dashboard.py       # Procedures getMetrics, getQualityRates, trends
  sync.py            # Procedures preview, execute, status-to-gitlab
  crosstest.py       # Procedures crosstest-related
  analytics.py       # Procedures analytics, anomalies
  ...
```

### 1.3 Supprimer ou documenter `frontend/src/server/`

**Problem** : 13 fichiers de services TypeScript dans le frontend (analytics, anomaly, audit, auth/jwt, gitlab, notifications, retention, report, webhooks, users, etc.) qui doublonnent le backend Python.

**Action** :

- Si code mort -- supprimer proprement le dossier `server/`
- Si besoin futur (SSR, BFF, edge functions) -- documenter le role dans un `README.md` dans ce dossier

---

## PRIORITE 2 -- Decoupage frontend

### 2.1 Splitter les gros composants

| Composant        | Lignes | Action recommandee                                            |
| ---------------- | ------ | ------------------------------------------------------------- |
| `Dashboard6.tsx` | 833    | Extract en `CrossTestPanel`, `CommentsSection`, `IssuesPanel` |
| `AppLayout.tsx`  | 606    | Extract `Sidebar`, `TopBar`, `ExportMenu`, `ProjectSelector`  |
| `Dashboard8.tsx` | 446    | Extract `SyncControls`, `SyncProgress`, `SSEMonitor`          |
| `Dashboard7.tsx` | 433    | Extract `ComparisonPanel`, `RadarChart`, `MetricTable`        |

**Pattern** : Sortir la logique metier et le state dans des hooks dedies, ne laisser que le JSX dans les composants UI.

### 2.2 Adopter TanStack Table

Les tableaux dans Dashboard6 et Dashboard7 utilisent du tri/filtrage/pagination fait main. Remplacer par `@tanstack/react-table` pour moins de code et de bugs.

---

## PRIORITE 3 -- Robustesse backend

### 3.1 Tests d'integration API

**Etat actuel** : 15 fichiers de tests unitaires de services uniquement.

**Manque** :

- Tests des routes FastAPI avec `httpx.AsyncClient`
- Tests de scenario complet : sync GitLab -> Testmo -> verification resultats
- Tests de resilience : Testmo down, GitLab 500, timeout, rate limit

**Exemple** :

```python
async def test_dashboard_metrics_returns_istqb_data(async_client, testmo_mock):
    testmo_mock.stub_runs(FIXTURE_RUNS)
    resp = await async_client.get("/api/dashboard/1")
    assert resp.status_code == 200
    data = resp.json()
    assert "pass_rate" in data and data["pass_rate"] > 0
```

### 3.2 Health check complet

Le router `health.py` devrait verifier :

- Connectivite Testmo (ping API)
- Connectivite GitLab
- Etat des circuit breakers (open/half-open/closed)
- Espace disque pour les fichiers SQLite
- Taille de la queue PDF
- Latence moyenne des dernieres requetes

### 3.3 Support PostgreSQL en option

**Pourquoi** : SQLite lock en ecriture concurrente. Risque si multi-utilisateurs ou jobs en parallele.

**Comment** : SQLAlchemy est deja abstrait + Alembic migrations en place. Il suffit d'ajouter un driver `asyncpg` et une variable d'environnement `DATABASE_URL`.

---

## PRIORITE 4 -- Developer experience

### 4.1 Docker Compose global

**Etat actuel** : `backend_py/docker-compose.python.yml` existe mais ne couvre que le backend.

**Objectif** : Un `docker-compose.yml` a la racine qui lance frontend + backend + DB eventuelle

```yaml
services:
  backend:
    build: ./backend_py
    env_file: ./backend_py/.env
    ports: ['3001:3001']
  frontend:
    build: ./frontend
    ports: ['8080:80']
    depends_on: [backend]
```

### 4.2 Pre-commit hooks

Config `pre-commit` avec :

- Ruff (lint + format Python)
- MyPy (type checking Python)
- ESLint + Prettier (lint + format frontend)
- Verifier que les `.env` ne sont pas commit

### 4.3 Makefile ou script de setup

```bash
make setup      # Install deps backend + frontend, Playwright browsers, init DB
make dev        # Lance backend + frontend en mode dev (parallele)
make test       # pytest backend + vitest frontend
make lint       # ruff + mypy + eslint
make docker     # Build et lance via docker-compose
```

---

## PRIORITE 5 -- Functionnalites

### 5.1 Ameliorer l'auto-sync

- Supporter plusieurs configurations d'auto-sync (pas un seul run/iteration)
- Accepter des webhooks GitLab en plus du cron (push, merge, tag)
- Dashboard de monitoring des sync : historique, taux de succes, dernieres erreurs, temps d'execution

### 5.2 Alerting proactif

Le fichier `app/services/alerting.py` existe mais est basique. Ameliorations possibles :

- Integration Slack/Teams via webhooks (en plus de SMTP)
- Thresholds configurables par projet via l'UI
- Anomaly detection automatique via le service `anomaly.py` deja existant
- Escalade : warning -> critical -> page

---

## Quick wins (1 jour ou moins)

- [ ] Ajouter des docstrings sur les routers FastAPI
- [ ] Uniformiser les conventions de noms (snake_case Python / camelCase TS -- deja fait, verifier la coherence)
- [ ] Ajouter des commentaires explicatifs sur les mapping de status Testmo non-standards (2=Passed, 3=Failed, 4=Retest, 8=WIP)
- [ ] Mettre a jour les dependances Python (verifier les versions dans `pyproject.toml`)
- [ ] Ajouter un fichier `.dockerignore` dans chaque sous-dossier
