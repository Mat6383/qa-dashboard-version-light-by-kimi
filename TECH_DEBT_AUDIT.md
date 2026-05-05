# Tech Debt Audit — QA Dashboard

Generated: 2026-05-04
Updated: 2026-05-05 (post-P34 cutover)

## Executive summary

- **1 Critical finding**, **6 High**, **12 Medium**, **8 Low** (2 Medium résolus en P34)
- **Largest debt concentration**: `backend/` Node/Express legacy — ~600 `any` types, accumulation technique sur ~40k LOC (réduction suite suppression services sync obsolètes)
- **Backend Python (FastAPI)** : autonome en production sur port 3001, 206 tests, dette quasi nulle
- **Cutover P34 complété** : routes `/api/sync/*`, `/api/testmo-browser/*`, `/api/crosstest/*` désormais 100 % Python. 15 fichiers Node.js morts supprimés (services, routes, jobs, tests).
- **Frontend** : dette principalement dans les tests (types Jest manquants) et les modals (>900 LOC)
- **Documentation drift sévère** : README partiellement obsolète ; OpenAPI régénérée depuis FastAPI ✅
- **Aucune vulnérabilité critique** (2 modérées via `exceljs` → `uuid`)
- **Aucune dépendance circulaire** détectée (frontend + backend) — architecture modulaire saine

---

## Architectural mental model

Le système est un dashboard QA full-stack qui orchestre la synchronisation bidirectionnelle **Testmo ↔ GitLab**. Le cutover P34 a basculé les routes sync/testmo-browser/crosstest vers Python. Le backend Node.js reste actif pour les routes non encore décommissionnées (dashboard, runs, projects, reports, etc.) mais est en mode maintenance.

1. **Backend Node/Express** (legacy, ~15k LOC restants) — API REST, tRPC, SQLite, Puppeteer. Les services sync/testmoBrowser/crosstest ont été supprimés en P34.
2. **Backend Python/FastAPI** (actif en production, port 3001, ~10k LOC) — Toutes les routes sync, health, auth, webhooks, feature-flags, et plus sont servies par Python.
3. **Frontend React 18 + Vite** (~15k LOC) — 8 dashboards, modals de clôture, exports PDF/DOCX/PPTX. Proxy Vite pointe sur `localhost:3001` (Python).

Le frontend communique exclusivement avec le backend Python en production. Le legacy Node est conservé en warm-standby pour les routes restantes jusqu'à leur propre cutover.

---

## Findings

| ID       | Category                           | File:Line                                             | Severity   | Effort | Description                                                                                                             | Recommendation                                                                                |
| -------- | ---------------------------------- | ----------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| F001     | Architectural decay                | `backend/services/testmo.service.ts:1`                | Critical   | L      | God-class de 1 537 LOC gérant cache, circuit breaker, retry, exports, browser automation, auth                          | Découper en `TestmoClient`, `TestmoCache`, `TestmoExport`, `TestmoBrowser`                    |
| F002     | Architectural decay                | `frontend/src/components/TestClosureModal.tsx:1`      | High       | L      | Modal de 922 LOC mélangeant UI, logique métier, export PDF, state complexe                                              | Extraire la logique PDF dans un hook, découper en sous-composants                             |
| F003     | Architectural decay                | `backend/services/gitlab.service.ts:1`                | High       | L      | Service de 920 LOC avec GraphQL + REST + parsing + retry + cache                                                        | Découper en `GitlabRestClient`, `GitlabGraphQLClient`, `GitlabParser`                         |
| F004     | Type & contract debt               | `backend/middleware/*.ts` (multiple)                  | High       | M      | 716 usages de `any` dans le backend, majoritairement dans les middlewares Express (`req: any`, `res: any`, `next: any`) | Typer avec `Request`, `Response`, `NextFunction` d'Express ou des interfaces projet           |
| F004b    | Type & contract debt               | `backend_py/app/services/testmo.py` (multiple)        | High       | S      | `Returning Any` sur méthodes `_cached_request` / `_post` / `_patch`                                                     | Caster retours avec variables typées intermédiaires                                           |
| F005     | Type & contract debt               | `frontend/src/components/Dashboard6.tsx:316`          | High       | S      | Accès `.error` sur `ApiResponse<T>` sans type guard — provoque une erreur TS à la compilation                           | Utiliser le type guard `isApiSuccess()` déjà existant dans `api.types.ts`                     |
| F006     | Documentation drift                | `README.md:135-170`                                   | High       | S      | README obsolète : référence `server.js`, `App.jsx`, `MetricsCards.jsx` qui n'existent plus                              | Synchroniser README avec la structure actuelle (`backend_py/`, tRPC, Dashboard 4-8)           |
| F007     | Dependency & config debt           | `backend/package.json:45`                             | Medium     | S      | 2 vulnérabilités modérées `uuid < 14.0.0` via `exceljs@4.x`                                                             | Upgrader `exceljs` ou forcer `uuid@^9` via `overrides`                                        |
| F008     | Type & contract debt               | `frontend/src/` (10 fichiers de test)                 | Medium     | M      | Types Jest manquants (`toBeInTheDocument`, `beforeEach`) dans tsconfig — 96 erreurs TS                                  | Ajouter `"@testing-library/jest-dom"` dans `types` du tsconfig ou migrer vers `vitest` types  |
| F009     | Type & contract debt               | `frontend/src/types/api.types.ts:58-88`               | Medium     | S      | Types API frontend miroir du backend — risque de drift si le backend change                                             | Générer automatiquement depuis OpenAPI (`openapi-typescript`) ou via le tRPC bridge Python    |
| F010     | Type & contract debt               | `backend_py/app/models/base.py:1`                     | Medium     | S      | mypy bloqué : "Source file found twice" (`models.base` vs `app.models.base`)                                            | Ajouter `__init__.py` manquants ou configurer `MYPYPATH` / `--explicit-package-bases`         |
| F011     | Consistency rot                    | `frontend/src/components/Dashboard6.tsx:175`          | Medium     | S      | `const filters: any = {}` et `body: any` — perte de type safety sur les payloads API                                    | Définir des interfaces `SyncFilters`, `SyncBody`                                              |
| F012     | Consistency rot                    | `frontend/src/components/RetentionAdmin.tsx:16`       | Medium     | S      | `value: any` et `(p: any)` dans un composant admin qui devrait être fortement typé                                      | Utiliser les types du backend ou définir `RetentionPolicy`, `ArchiveSnapshot`                 |
| F013     | Test debt                          | `frontend/src/components/`                            | Medium     | M      | ~15 fichiers de test avec `toBeInTheDocument` non reconnu — tests probablement non exécutés en CI                       | Corriger tsconfig + lancer `vitest run` en CI et bloquer le merge si échec                    |
| ~~F014~~ | ~~Performance & resource hygiene~~ | ~~`backend/services/testmoBrowser.service.ts:1`~~     | ~~Medium~~ | —      | ~~Service supprimé en P34 — remplacé par `backend_py/app/services/testmo_browser.py` (Playwright)~~                     | ~~Résolu P34~~                                                                                |
| F015     | Error handling & observability     | `backend/middleware/metrics.ts:78`                    | Medium     | S      | `catch (err: any)` avec log sans structure — pas de corrélation requestId                                               | Utiliser `logger.child({ requestId })` et typer l'erreur                                      |
| F016     | Error handling & observability     | `frontend/src/components/FeatureFlagsAdmin.tsx:101`   | Low        | S      | 4 blocs `catch (err: any)` identiques sans log ni feedback utilisateur                                                  | Normaliser la gestion d'erreur avec un hook `useApiError`                                     |
| F017     | Dependency & config debt           | `frontend/package.json:23`                            | Low        | S      | `lucide-react@0.263.1` très ancien (2023) — versions récentes apportent tree-shaking optimisé                           | Upgrader vers `lucide-react@^0.400+`                                                          |
| F018     | Consistency rot                    | `reports/generate_R06_pptx.js:1`                      | Low        | S      | Script Node standalone à la racine utilisant `pptxgenjs` directement — pas intégré au build                             | Migrer dans `frontend/src/utils/` ou `backend_py/app/services/report/`                        |
| F019     | Security hygiene                   | `backend/routes/runs.routes.ts:34`                    | Low        | S      | `req.query.status` utilisé sans validation Zod dans une route publique                                                  | Ajouter `z.string().regex(/^[\d,]+$/).parse()`                                                |
| F020     | Test debt                          | `backend/tests/calculations.test.ts:1`                | Low        | M      | Fichier de test de 936 LOC — difficile à maintenir, pas de `describe` imbriqué                                          | Découper en `status-sync.test.ts`, `label-changes.test.ts`, `version-filter.test.ts`          |
| F021     | Documentation drift                | `frontend/src/trpc/client.ts:10`                      | Low        | S      | TODO commenté depuis longtemps : "générer un AppRouter côté frontend depuis le bridge Python"                           | Implémenter le bridge tRPC Python ↔ Frontend ou supprimer le TODO                             |
| F022     | Architectural decay                | `frontend/src/utils/docxGenerator.ts:1`               | Medium     | L      | 652 LOC générant des documents DOCX avec `docx` lib — très complexe, pas de tests                                       | Extraire en service backend (`backend_py/app/services/report/`) ou ajouter des tests snapshot |
| F023     | Consistency rot                    | `backend/services/`                                   | Medium     | M      | Duplication de logique retry/circuit breaker dans `testmo.service.ts`, `gitlab.service.ts`, `sync.service.ts`           | Extraire un `ResilientHttpClient` commun avec retry, circuit breaker, timeout                 |
| F024     | Type & contract debt               | `backend/services/featureFlags.service.d.ts:1`        | Medium     | S      | Fichier `.d.ts` orphelin à côté du `.ts` — risque de divergence                                                         | Fusionner dans `featureFlags.service.ts` ou supprimer si non utilisé                          |
| F025     | Performance & resource hygiene     | `backend/server.ts:1`                                 | Low        | M      | Pas de graceful shutdown pour les WebSockets (`websocket/index.ts`) — connexions coupées brutalement                    | Appeler `wss.close()` dans le handler `gracefulShutdown`                                      |
| F026     | Dependency & config debt           | `backend/package.json:1`                              | Low        | S      | `marked@^4.3.0` déprécié, `yamljs@^0.3.0` sans maintenance — accumuler des libs obsolètes                               | Upgrader `marked` vers v15+, remplacer `yamljs` par `js-yaml`                                 |
| F027     | Test debt                          | `backend/tests/integration/routes.coverage.test.js:1` | Medium     | M      | Test de 742 LOC avec mocks complexes et pas de couverture de la vraie DB                                                | Migrer vers des tests d'intégration avec `better-sqlite3` en mémoire                          |
| F028     | Architectural decay                | `backend/services/backup.service.ts:1`                | Medium     | M      | 429 LOC gérant backup local, S3, rsync, rotation, restore — trop de responsabilités                                     | Découper en `BackupLocal`, `BackupS3`, `BackupRotation`, `BackupRestore`                      |

---

## Top 5 "if you fix nothing else, fix these"

### 1. F001 — Décomposer `testmo.service.ts` (1 537 LOC)

Ce fichier est le cœur du backend et contient ~8% de tout le codebase. Il gère l'API Testmo, le cache, les retries, les exports, le browser automation (Puppeteer) et l'authentification. Une régression ici affecte tout le dashboard.

**Outline du refactor** :

```
backend/services/testmo/
├── client.ts       # HTTP client Testmo (axios + retry)
├── cache.ts        # In-memory cache + anti-stampede
├── export.ts       # Export CSV/Excel/PDF
├── browser.ts      # Puppeteer interactions
└── auth.ts         # Token refresh / session
```

### 2. F004 — Typer les middlewares Express

716 `any` dans le backend est un signal d'alarme. Les middlewares (`auth.middleware.ts`, `audit.middleware.ts`, `requestLogger.ts`) sont les portes d'entrée du système. Les typer correctement permettrait de détecter des bugs de sécurité (ex: `req.user` non vérifié) à la compilation.

**Diff sketch** :

```ts
// Avant
function requireAuth(req: any, res: any, next: any) { ... }

// Après
interface AuthenticatedRequest extends Request {
  user: { id: number; email: string; role: string };
}
function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) { ... }
```

### 3. F006 — Réécrire le README

Le README est la première chose qu'un nouveau développeur lit. Référencer `App.jsx` et `server.js` alors que le projet utilise `main.tsx` et `server.ts` crée de la confusion immédiate. C'est 30 min de travail pour un gain d'onboarding énorme.

### 4. F005 — Corriger le type guard `ApiResponse` dans Dashboard6

2 lignes à corriger. Utiliser le type guard déjà présent dans le codebase :

```ts
const res = await apiService.exportRun(...);
if (!isApiSuccess(res)) {
  setError(res.error); // maintenant typé correctement
  return;
}
```

### 5. F007 — Forcer `uuid@^9` dans le backend

2 lignes dans `package.json` :

```json
"overrides": {
  "exceljs": {
    "uuid": "^9.0.0"
  }
}
```

---

## Quick wins

- [x] **F007** : Forcer `uuid@^9` via `overrides` dans `backend/package.json` (2 min) — Livré P32
- [x] **F005** : Utiliser `isApiSuccess()` dans `Dashboard6.tsx:316` et `:362` (5 min) — Livré P32
- [x] **F019** : Ajouter validation Zod sur `runs.routes.ts:34` (10 min) — Livré P32
- [x] **F010** : Ajouter `__init__.py` dans `backend_py/app/models/` pour mypy (5 min) — Livré P32
- [x] **F021** : Documenter l'import `AppRouter` via path alias `~server` (monorepo) (15 min) — Livré P32
- [x] **F026** : Upgrader `marked` et remplacer `yamljs` (20 min) — Livré P32
- [x] **F008** : Ajouter `"@testing-library/jest-dom"` dans `frontend/tsconfig.json` types (5 min) — Livré P32

---

## Things that look bad but are actually fine

- **Le double backend** (Node legacy + Python actif) est une **migration intentionnelle et progressive**. Le cutover P34 a retiré le code sync Node.js. Les routes restantes (dashboard, runs, projects, reports) sont encore sur Node.js en attendant leur propre cutover. Le Node.js compile toujours (0 erreur TS) et ses tests passent (578/578). C'est une stratégie valide.
- **Les 47 `any` dans le frontend** sont concentrés dans les tests et les composants admin (FeatureFlags, Retention, Dashboard6). Ce n'est pas idéal mais ce n'est pas critique car ce sont des zones à faible trafic utilisateur.
- **`backend/services/featureFlags.service.d.ts`** existe à côté du `.ts`. C'est un pattern TypeScript valide pour séparer les types publics de l'implémentation, même si ici le fichier semble orphelin.
- **Le `any` dans les middlewares du backend** est mauvais en soi, mais Express 5 + TypeScript 6 rend le typage des middlewares plus difficile qu'avec Fastify/FastAPI. Ce n'est pas une excuse, mais ce n'est pas un choix totalement irresponsable.

---

## Open questions for the maintainer

- **Migration Python** : Le cutover sync (P34) est terminé. Le calendrier pour les routes restantes (dashboard, runs, projects, reports) dépendra des priorités métier. Tous les équivalents Python existent déjà (`backend_py/app/routers/*.py`).
- **Tests frontend** : Les tests avec `toBeInTheDocument` non reconnu sont-ils exécutés en CI ? Si non, pourquoi ?
- **tRPC bridge** : Le `trpc_bridge.py` est-il utilisé en production ou est-ce un POC abandonné ? Le frontend utilise `api.service.ts` (REST) et non le tRPC client.
- **Puppeteer vs Playwright** : Le backend Node utilise encore Puppeteer pour les routes survivantes (pdf, exports). Le backend Python utilise Playwright (testmo_browser, pdf). Quand le Node sera entièrement décommissionné, Puppeteer disparaîtra avec lui.
- **`reports/generate_R06_pptx.js`** : Ce script est-il encore utilisé manuellement ou a-t-il été remplacé par le générateur PPTX du backend Python ?
- **WebSockets** : Le `websocket/index.ts` est-il utilisé par le frontend actuellement ? Le dashboard semble utiliser SSE (Dashboard6) et REST polling.
