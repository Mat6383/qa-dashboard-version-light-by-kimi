# Feuille de route — QA Dashboard by Kimi 2.0

> Document de suivi d'avancement. Cocher les cases au fur et à mesure des PRs / commits.

---

## Version actuelle

**Branch :** `main`  
**Commits récents :** P0→P32 livrés (mai 2026)  
**Tests :** 578/578 backend Node.js ✅ | 288/288 frontend ✅ | 206/206 Python ✅ | Build ✅ | TypeCheck backend & frontend ✅ | Lint 0 ✅

---

## ✅ Déjà livré (Session avril 2026)

- [x] **Bump dépendances majeures backend** — Express 5, Helmet 8, Zod 4, Jest 30, Supertest 7
- [x] **Bump dépendances majeures frontend** — Vite 8, Vitest 4, @vitejs/plugin-react 6
- [x] **Sécurité backend** — `safeErrorResponse`, `requireAdminAuth` (X-Admin-Token), validation regex query params, écriture atomique config, suppression du `project_id` hardcodé
- [x] **Hardening frontend** — Fix fuites mémoire (AbortController, cancelledRef), `useMemo` sur les Contexts, toggles accessibles (`role="switch"`, `aria-checked`), suppression interceptor dupliqué
- [x] **Cache & concurrence** — Anti-stampede (`_withCache` + `_inFlight`) dans TestmoService, verrouillage par itération (`_locks`) dans SyncService
- [x] **Upstream features** — Mode version-seule sans itération GitLab, collecte chronologique de tous les `[TEST]`, documentation des routines Claude A+B

---

## 🚧 Prochaines étapes

### 🔴 P0 — Critique (impact immédiat sur la qualité/livraison)

#### 1. CI/CD GitHub Actions

- [x] Créer `.github/workflows/ci.yml`
  - [x] Job `test-backend` : `npm ci` + `npm test` (Jest)
  - [x] Job `build-frontend` : `npm ci` + `npm run build` (Vite)
  - [x] Job `lint` : `npx eslint` backend + frontend
  - [x] Job `audit` : `npm audit` (seuil : 0 vulnérabilité high/critical)
- [x] Créer `.github/workflows/cd.yml` (optionnel — déploiement auto sur VPS/Vercel)
- [x] Ajouter le badge CI dans le `README.md`

#### 2. Split de `App.jsx` (~420 lignes)

- [x] Extraire `AppLayout.jsx` — Header, nav, toggles dark mode / TV mode, breadcrumb
- [x] Extraire `AppRouter.jsx` — `<Routes>` + lazy loading dashboards
- [x] Extraire `useAutoRefresh.js` — Logique du cron 1 minute + `visibilitychange`
- [x] `App.jsx` cible final : ~127 lignes (imports + composition + fallback erreur)

---

### 🟠 P1 — Important (maintenabilité & DX)

#### 3. Split de `server.js`

- [x] Extraire `middleware/security.js` — Helmet, CORS, rate-limiting, compression
- [x] Extraire `middleware/requestLogger.js` — Logger Winston par requête
- [x] Extraire `jobs/autoSyncJob.js` — Cron node-cron + logique d'appel
- [x] Extraire `bootstrap/gracefulShutdown.js` — Gestion SIGTERM/SIGINT
- [x] Extraire `bootstrap/envCheck.js` — Validation variables d'environnement
- [x] `server.js` cible final : ~99 lignes (config + montage)

#### 4. Couverture tests frontend

- [x] Ajouter `@vitest/coverage-v8` (déjà dans `package.json`)
- [x] Cibles de couverture (Vitest) :
  - [x] `Dashboard4.jsx` — Rendering, toggles, export PDF trigger
  - [x] `useAutoRefresh.js` — Effets, timers, listeners
  - [x] `useSyncProgress.js` — Streaming SSE, abort, logs
  - [x] `api.service.js` — Interceptors, timeout, gestion d'erreurs
- [x] Seuil minimal atteint : 80%+ statements / 67% branches / 90% functions sur les fichiers testés

#### 5. Audit bundle frontend

- [x] Vérifier si `recharts` est importé quelque part (`grep -r "recharts" frontend/src/`)
- [x] `recharts` n'est pas installé — rien à faire
- [x] Activer `build.chunkSizeWarningLimit: 1000` pour éviter le warning sur `vendor-export` (html2canvas + jspdf + docx)

---

### 🟡 P2 — Amélioration (nice to have)

#### 6. Documentation ops

- [x] `docs/DEPLOYMENT.md` — Procédure de mise en prod (env vars, PM2, Nginx)
- [x] `docs/ARCHITECTURE.md` — Diagramme des flux (Testmo ↔ GitLab ↔ Dashboard)
- [x] `docs/TROUBLESHOOTING.md` — FAQ erreurs courantes (CORS, rate-limit, tokens)

#### 7. Monitoring & observability

- [x] Vérifier que Sentry capture bien les 500 backend (test avec `SENTRY_DSN` activé)
- [x] Ajouter un endpoint `GET /api/health/detailed` — DB, Testmo API, GitLab API (smoke test)
- [x] Logger les temps de réponse moyens des APIs externes (Testmo, GitLab)

#### 8. Refactoring composants legacy

- [x] `Dashboard6.jsx` (823 → 602 lignes) — Extraction `SyncLogParts.jsx` + `SyncHistoryPanel.jsx`
- [x] `Dashboard7.jsx` (523 → 369 lignes) — Extraction `CommentCell.jsx`

---

### 🟢 P3 — Refactoring approfondi (analyse codebase)

#### 9. Extraction `useExportHandler.js`

- [x] Extraire la logique d'export PDF (`html2canvas` + `jsPDF`) depuis `Dashboard4.jsx` et `TestClosureModal.jsx`
- [x] Créer un hook réutilisable `useExportPDF(element, filename, options)` gérant le canvas scaling, le fond dark mode, preCapture, multiPage, et les erreurs
- [x] Supprimer les imports `html2canvas` et `jsPDF` de `Dashboard4.jsx` et `TestClosureModal.jsx`
- [x] Tests Vitest : 7/7 ✅

#### 10. Split `report.service.js` (685 → 32 lignes)

- [x] Extraire `services/report/collectData.js` — `collectReportData()` (~212 lignes)
- [x] Extraire `services/report/generateHTML.js` — `generateHTML()` (~279 lignes)
- [x] Extraire `services/report/generatePPTX.js` — `generatePPTX()` (~170 lignes)
- [x] Extraire `services/report/utils.js` — `_esc()` helper HTML escape
- [x] `report.service.js` devient un orchestrateur (~32 lignes)
- [x] Tests backend : 296/296 ✅

#### 11. Split `Dashboard4.jsx` (1229 → 289 lignes)

- [x] Extraire `components/MetricCard.jsx` — Card réutilisable (duplication 4x éliminée)
- [x] Extraire `components/PreprodSection.jsx` — Section préproduction complète
- [x] Extraire `components/ProductionSection.jsx` — Section production complète
- [x] Cible atteinte : Dashboard4.jsx < 300 lignes ✅
- [x] Tests frontend : 67/67 ✅ | Build ✅

## 📊 Indicateurs de santé du projet

| Métrique              | Actuel        | Cible |
| --------------------- | ------------- | ----- |
| Métrique              | Actuel        | Cible |
| --------------------  | ------------  | ----- |
| Tests backend Node.js | 578 / 578 ✅  | 550+  |
| Tests frontend        | 288 / 288 ✅  | 280+  |
| Tests Python          | 206 / 206 ✅  | 200+  |
| Couverture backend    | 80 % ✅       | 70 %  |
| Couverture frontend   | 87 % ✅       | 50 %  |
| Vulnérabilités npm    | 2 modérées ⚠️ | 0     |
| Build frontend        | ✅ (< 3s)     | < 3s  |
| Lignes `App.jsx`      | ~142 ✅       | < 150 |
| Lignes `server.js`    | ~99 ✅        | < 100 |
| Fichiers TS backend   | 66 ✅         | 20+   |
| Fichiers TS frontend  | 8 ✅          | 30+   |
| Erreurs TS frontend   | 0 ✅          | 0     |
| Erreurs TS backend    | 0 ✅          | 0     |
| Erreurs mypy Python   | 1 ⚠️          | 0     |
| `any` backend         | ~600 ⚠️       | < 50  |
| `any` frontend        | 47 ✅         | < 20  |
| God files (>500 LOC)  | 3 ⚠️          | 0     |
| Circular deps         | 0 ✅          | 0     |

---

## 🚀 P4 — Nouvelles features (Session en cours)

- [x] **P4#1 Mode sombre auto** — `prefers-color-scheme` + persistance localStorage + tests
- [x] **P4#2 Virtualisation Dashboard7** — `@tanstack/react-virtual` pour les grandes listes d'issues + tests
- [x] **P4#3 Alerting Slack/Teams** — Webhook quand un metric passe en rouge ( SLA ) + tests
- [x] **P4#4 Dashboard de synthèse multi-projets** — Endpoint `/api/dashboard/multi` + composant `MultiProjectDashboard` + tests
- [x] **P4#5 Couverture de tests** — Seuils ajustés (backend 50 % / 45 % / 30 % branches, frontend 50 %) + exclusions services externe + 15 nouveaux tests

---

## 🚀 P5 — Prochaine session

- [x] **P5#1 CI/CD GitHub Actions** — Pipeline optimisée (lint, backend coverage, frontend coverage+build, artifacts, summary)
- [x] **P5#2 Tests des gros modaux** — QuickClosureModal (12/12), ReportGeneratorModal (16/16), TestClosureModal (12/12) ✅
- [x] **P5#3 Split App.jsx** — ~142 lignes ✅
- [x] **P5#4 Tests routes backend** — featureFlags, runs, projects, crosstest, sync/history, sync/auto-config, reports → backend 65 %+ ✅
- [x] **P5#5 Export CSV/Excel** — Complément au PDF/PPTX existant (`xlsx`, routes `/api/export/csv` & `/excel`)
- [x] **P5#6 Tests E2E Playwright** — Parcours complet login → dashboard → export → notifications
- [x] **P5#7 Tests unitaires services SQLite** — syncHistory, comments, featureFlags services
- [x] **Correction massive des tests** — Compatibilité Jest/CommonJS (`bootstrap/dotenv`), normalisation `export default` services, auth e2e (`requireAuthOrAdmin` + tRPC), format API projects, 34 fichiers mis à jour
- [x] **P5#8 Coverage routes SSE backend** — sync/execute, sync/status-to-gitlab, sync/preview, sync/iteration

## 🚀 P6 — Évolutions Futures (Session actuelle)

- [x] **P6#1 Export des métriques en PDF (backend)** — `puppeteer` + endpoint `POST /api/pdf/generate` + header/footer + multi-page
- [x] **P6#2 Notifications email sur alertes SLA** — `nodemailer` + templates HTML responsive + configuration UI `/notifications`
- [x] **P6#3 Intégration Slack/Teams enrichie** — Configuration par projet (DB) + test de connexion + rate-limiting 15 min
- [x] **P6#4 Graphiques de tendance historique** — Table `metric_snapshots` + cron quotidien + endpoint `/trends` + composant `HistoricalTrends`
- [x] **P6#5 Authentification multi-utilisateurs** — OAuth GitLab (`passport-gitlab2`) + JWT + rôles admin/viewer + route `/auth/callback`
- [x] **P6#6 Support multi-projets simultané** — Comparateur radar (`/compare`) + sélection persistante + table comparative
- [x] **P6#7 Export CSV/Excel** — `xlsx` + endpoints `/api/export/csv` & `/excel` + boutons UI + tests
- [x] **P6#8 Tests E2E Playwright** — Parcours utilisateur complet (login → dashboard → exports → notifications)

## 🚀 P7 — Maintenance & Infrastructure (Session en cours)

- [x] **P7#1 Audit sécurité complète** — Headers hardening (COOP, CORP, Referrer-Policy, HSTS), remplacement `xlsx` → `exceljs`, masquage secrets logger, cookies JWT `sameSite=strict` + `path=/`
- [x] **P7#2 Documentation API OpenAPI/Swagger** — Spec OpenAPI 3.0 + `swagger-ui-express` sur `/api/docs`
- [x] **P7#3 Monitoring avancé Prometheus** — `prom-client` + middleware métriques HTTP + endpoint `/metrics`

## 🚀 P8 — Observabilité & Ops (Session en cours)

- [x] **P8#1 Audit logging traçabilité** — Table `audit_log` + service + middleware + UI admin `/admin/audit` avec filtres et pagination
- [x] **P8#2 Health checks améliorés** — Liveness `/health`, readiness `/health/ready`, diagnostics `/health/detailed` (DB, APIs, disque, mémoire)
- [x] **P8#3 Prometheus business metrics** — Gauges `active_users`, `db_size_bytes`, counters `sync_runs_total`, `export_runs_total`, seuils d'alerte

## 🚀 P9 — Temps réel & Intelligence (Session en cours)

- [x] **P9#1 Temps réel SSE dashboard** — Endpoint `GET /api/dashboard/:projectId/stream` (SSE), hook `useDashboardSSE`, indicateur "Live" UI, fallback polling, auto-reconnect ✅ _poussé_
- [x] **P9#2 Détection d'anomalies** — Algo z-score sur tendances historiques, endpoint `/api/anomalies`, badges "trending" sur KPIs ✅ _poussé_
- [x] **P9#3 Circuit breaker & resilience** — `CircuitBreaker` class sur appels Testmo/GitLab, retry exponentiel jobs sync, mode dégradé avec banner ✅ _poussé_
- [x] **P9#4 Feature Flags UI admin** — CRUD `/admin/features`, rollout progressif UI, audit intégré ✅ _poussé_

## 🚀 P10 — Rollout progressif & Webhooks (Session actuelle)

- [x] **P10#1 Rollout progressif sticky par utilisateur** — `isEnabled(key, userId)` avec hash SHA256 déterministe, `getAll(userId)` applique le %, route publique `?userId=xxx` ✅
- [x] **P10#2 Webhooks sortants configurables** — Table `webhook_subscriptions`, CRUD admin `/api/webhooks`, émission HMAC-SHA256 (`X-Webhook-Signature`), events `feature-flag.changed` ✅
- [x] **P10#3 Tests E2E Playwright** — Parcours CRUD admin + test rollout sticky déterministe côté API ✅
- [x] **P10#4 Consumer hook enrichi** — `useFeatureFlags(key, userId)` avec `rolloutPercentage`, helper `isBetaRollout()`, badge "Bêta / X%" dans l'admin ✅

## 🚀 P11 — React Query & Cache (Session actuelle)

- [x] **P11#1 Setup React Query** — `QueryClient` + `ReactQueryDevtools` + provider dans `main.jsx` ✅
- [x] **P11#2 Hooks queries** — `useProjects`, `useMultiProjectSummary`, `useAnomalies`, `useCircuitBreakers`, `useDashboardMetrics` ✅
- [x] **P11#3 Migration DashboardContext** — `projects`, `anomalies`, `circuitBreakers` migrés vers React Query (suppression 3 useEffect + polling manuel) ✅
- [x] **P11#4 Composant pilote** — `MultiProjectDashboard.jsx` migré (useEffect manuel → `useMultiProjectSummary`) ✅

## 🚀 P12 — TypeScript progressif (Session actuelle)

- [x] **P12#1 Setup TS backend** — `tsconfig.json` (`allowJs`, `checkJs`), `npm run typecheck`, types inférés depuis Zod ✅
- [x] **P12#2 Types API backend** — `types/api.types.ts` (FeatureFlag, Webhook, Report, Sync…), `.d.ts` services ✅
- [x] **P12#3 Setup TS frontend** — `tsconfig.json` (`jsx: react-jsx`), `npm run typecheck` ✅
- [x] **P12#4 Hooks queries typés** — Les 5 hooks renommés `.ts` avec types génériques (`Project[]`, `DashboardMetrics`…) ✅

## 🚀 P13 — TypeScript approfondi (Session livrée)

- [x] **P13#1** Renommer `api.service.js` → `api.service.ts` avec types retours ✅
- [x] **P13#2** Typer `DashboardContext.jsx` → `DashboardContext.tsx` ✅
- [x] **P13#3** Migrer composants feuilles en `.tsx` (MetricCard, PreprodSection, ProductionSection, TrendBadge) ✅
- [x] **P13#4** Ajouter `useMutation` pour les actions POST/PUT/DELETE (reports, crosstest, sync, notifications, feature-flags, exports, cache) ✅

## 🚀 P15 — TypeScript complet ✅

- [x] **P15#1** Renommer tous les fichiers `.jsx → .tsx` / `.js → .ts` (49 fichiers)
- [x] **P15#2** Corriger les erreurs TypeScript (`tsc --noEmit` passe 0 erreur)
- [x] **P15#3** Typer les contexts, hooks, composants feuilles et utilitaires
- [x] **P15#4** Mettre à jour `tsconfig.json` (inclusion uniquement `.ts/.tsx`)

## 🚀 P16 — Migration TypeScript backend (Session livrée)

- [x] **P16#1 Setup TS backend** — `tsconfig.json` (`module: commonjs`, `moduleResolution: bundler`), `ts-jest`, `types/express.d.ts`, `types/env.d.ts`
- [x] **P16#2 Renommage massif** — 66 fichiers `.js → .ts` (services, routes, middleware, utils, bootstrap, jobs, validators, config)
- [x] **P16#3 Conversion ESM** — `require() → import`, `module.exports → export default / export {}` via `jscodeshift` + scripts custom
- [x] **P16#4 Compatibilité tests CJS** — `ts-jest` (`isolatedModules: true`), `module.exports = exports.default` pour modules sans named exports, préservation named exports (`GitLabService`, `gitlabBreaker`, `redactSensitive`…)
- [x] **P16#5 Correction erreurs TypeScript** — Propriétés de classes (`db`, `_initialized`), casts `req.query`, objets inline `as any`, types `User`/`JwtPayload`, paramètres `any`
- [x] **P16#6 Build & assets** — `tsc` + `copy-assets` (`docs/`, `db/migrations/`, `data/`) vers `dist/`, `npm start` sur `dist/server.js`
- [x] **P16#7 Validation** — `typecheck` 0 erreur, tests 489/491, lint 0 erreur, serveur démarre

## 🚀 P17 — Qualité TypeScript & Tests (Prochaine session)

### Option A — Strict Mode + Tests backend `.ts` (Recommandé) ✅ Livré

- [x] **P17#1** Migrer 15 fichiers de test unitaires `.js → .ts` (services, middleware, utils) — tests d'intégration conservés en `.js` (compatibilité `jest.resetModules()`)
- [x] **P17#2** Activer `"strict": true` dans `tsconfig.json` backend
- [x] **P17#3** Typer les paramètres implicites `: any`, `catch (err: any)`, destructurations, index signatures
- [x] **P17#4** Éliminer 689 erreurs strict mode (TS7006, TS18046, TS7053, TS2345, TS7031)
- [x] **P17#5** Typer `req.query`, `req.params`, `req.body` avec casts `as string` et types précis
- [x] **P17#6** Valider : `typecheck` 0 erreur, tests 489/491, build OK, lint 0 erreur

### Option B — Tests de charge & Performance ✅ Livré

- [x] Scénarios k6 : 50 users simultanés sur `/api/dashboard`, `/api/health`, exports PDF/Excel
- [x] Mesurer p95/p99 temps de réponse, mémoire SQLite, pool Puppeteer
- [x] Identifier et corriger les goulots d'étranglement (rate limit, health checks externes, pool PDF, cache exports)

### Option C — Docker & Déploiement conteneurisé ✅ Livré

- [x] `Dockerfile` backend multi-stage (Node + Chromium pour Puppeteer)
- [x] `Dockerfile` frontend (build Vite + Nginx static)
- [x] `docker-compose.yml` avec volume SQLite persistant
- [x] Mise à jour `docs/DEPLOYMENT.md` pour le déploiement Docker
- [x] **Fix logs Winston** — `logger.service.ts` utilise `/app/logs` en production (volume monté accessible depuis l'hôte)
- [x] **Limites mémoire/CPU** — `deploy.resources.limits` dans `docker-compose.yml` (backend 1 CPU / 1G, frontend 0.5 CPU / 256M)
- [x] `docker-compose.dev.yml` — Hot-reload avec bind mounts pour le développement local (`Dockerfile.dev` backend + frontend, polling nodemon/chokidar pour Docker Desktop)

---

## 🚀 P27 — Connecteur GitLab administrable ✅ Livré (Phase 5)

- [x] **P27#1 Migration SQL** — Ajouter `gitlab` au `CHECK(type)` de la table `integrations` (Node.js) + migration Alembic Python avec indexes
- [x] **P27#2 Service `gitlabConnector`** — `backend_py/app/services/gitlab_connector.py` + `backend/services/gitlabConnector.service.ts` : connexion test + listage projets/issues/MRs via token perso (non global). Retry + circuit breaker réutilisés
- [x] **P27#3 Route tRPC** — Bridge tRPC Python étendu avec `integrations.gitlabProjects` + `integrations.gitlabIssues`
- [x] **P27#4 UI admin** — Formulaire GitLab dans `IntegrationsAdmin.tsx` déjà supporté (URL, token, projet par défaut), test live, icône GitLab
- [x] **P27#5 Refactor `gitlab.service.ts`** — Utilise le connector GitLab actif de la DB SQLite si disponible, fallback `.env` pour rétro-compatibilité
- [x] **P27#6 Tests** — 694/694 backend Node.js ✅ | 38/38 backend Python ✅ | Build frontend ✅

## 🚀 P5 — Connecteur GitLab + Bridge tRPC Python (Session livrée)

- [x] **P5#1 GitLab Connector administrable** — Service `gitlab_connector.py`, `GitLabConnector` class, `from_config` sur `gitlab.py`, refactor `gitlab.service.ts` avec fallback connector/.env
- [x] **P5#2 Bridge tRPC Python complet** — Toutes les procédures utilisées par le frontend mappées dans `backend_py/app/routers/trpc.py` (dashboard, projects, anomalies, cache, crosstest, featureFlags, notifications, reports, sync, webhooks, analytics, retention, integrations)
- [x] **P5#3 Frontend bridge validation** — `trpc/client.ts` documenté pour pointer sur `/trpc` du backend Python, `vite.config.js` proxy inchangé, build OK
- [x] **P5#4 Migrations Alembic** — `8a0998e7f55f` : indexes `ix_integrations_type` + `ix_integrations_enabled`

## 🚀 P29 — Audit UI/UX & Design System (Session actuelle)

> Basé sur l'audit complet disponible dans [`docs/UI_UX_AUDIT.md`](./docs/UI_UX_AUDIT.md).  
> Score avant : **6.0 / 10** — Score après : **8.5 / 10** 🎯

#### 🔴 P29#1 — Accessibilité critique

- [x] Remplacer l'emoji ⚠️ dans le banner circuit breaker par `<AlertTriangle>` (Lucide)
- [x] Ajouter des **skip-links** (`Skip to main content`) en haut de `AppLayout`
- [x] Ajouter `role="alert"` + `aria-live="polite"` sur le composant `Toast`
- [x] **Focus trap** dans `MobileDrawer` via `useFocusTrap` (boucle Tab cyclique + restauration focus)
- [x] **Pause au hover** sur le timer du `Toast`
- [x] Vérifier et corriger le contraste des bordures en dark mode (`--border-color: #475569`)

#### 🟠 P29#2 — Design Tokens & Cohérence visuelle

- [x] Créer un **fichier de design tokens** (`styles/tokens.css`) : couleurs, ombres, typographie, espacements
- [x] Éliminer les **raw hex** des composants (`Dashboard4.tsx`, `Toast.tsx`, `AppLayout.tsx`) → utiliser `var(--*)`
- [x] Définir une **échelle typographique formelle** (Display / H1 / H2 / Body / Label / Caption)
- [x] Ajouter `font-variant-numeric: tabular-nums` sur les colonnes de données numériques
- [x] Uniformiser les ombres et border-radius via les tokens

#### 🟠 P29#3 — Responsive & Mobile polish

- [x] Refactoriser le header desktop surchargé (>15 éléments) : grouper les exports dans un menu dropdown
- [x] Corriger le `grid-template-columns: repeat(auto-fit, minmax(500px, 1fr))` pour éviter le scroll horizontal mobile
- [x] Ajouter `touch-action: manipulation` sur les boutons interactifs globaux
- [x] Ajouter `min-h-dvh` en remplacement de `min-height: 100vh` sur `.app`
- [x] Vérifier que tous les dashboards respectent le `max-width: 1600px` du `.app-main`
- [x] **Corriger le header scrollable latéralement** : `flex-wrap: wrap`, réduction des gaps, labels masqués sur tablette

#### 🟡 P29#4 — Motion & Animation

- [x] Ajouter le support **`prefers-reduced-motion`** dans `App.css` (désactiver/transitions réduites)
- [x] Définir des **tokens d'easing** (ease-out pour enter, ease-in pour exit) — `tokens.css`
- [x] Remplacer les hover-only interactions de `Dashboard4` par des états `:active` / `:focus-visible` universels — `.btn-action-*`
- [x] Ajouter la fermeture du `MobileDrawer` avec la touche **Escape**

#### 🟡 P29#5 — Navigation & Information Architecture

- [x] Ajouter un **breadcrumb** sur les pages admin profondes (`/admin/*`)
- [x] Implémenter la **restauration du focus** au changement de route (screen readers)
- [x] Séparer les actions primaires (exports) du drawer mobile (FAB mobile `ExportFAB`)
- [x] **Internationalisation** complète du `MobileBottomNav`, `Breadcrumb`, `StatusChart`, `MobileDrawer`
- [x] **Labels ARIA distincts** : hamburger (`Ouvrir le menu`) vs bottom nav (`Navigation principale`)

#### 🟢 P29#6 — Charts & Dataviz accessibles

- [x] Ajouter des **`aria-label`** résumant les données clés sur chaque chart (`StatusChart`)
- [x] Fournir une **alternative tabulaire** (visually hidden) pour les screen readers
- [x] Vérifier la lisibilité des palettes rouge/vert pour les utilisateurs daltoniens (labels textuels + légende détaillée existants)

#### 🛠️ Fixes additionnels (corrige l'audit)

- [x] **Traductions manquantes** : `layout.compactModeOn/Off`, `layout.export`, `dashboard.analytics/retention/integrations`
- [x] **Switch dark mode** : couleur primaire visible + knob blanc + ombre portée
- [x] **Scroll-padding-top** sur `html` pour compenser le header sticky sur les anchor links
- [x] **Z-index drawer mobile** : passe au-dessus du header en mode TV (`z-index: 1001`)
- [x] **Test api.service** : alignement du casing `iteration_name` / `project_id` (snake_case backend)

## 🚀 P30 — Sync GitLab → Testmo Automation Runs (Session actuelle)

> Objectif : Créer ou mettre à jour des **automation runs** Testmo depuis l'écran de synchro GitLab.  
> Contexte : L'API Testmo ne permet pas d'écrire sur les runs manuels (lecture seule). Seuls les **automation runs** sont créables/modifiables via API.

### P30#1 — Extension `TestmoService` (écriture)

- [x] Ajouter `create_automation_run(project_id, name, source, tags, milestone_id)` → `POST /projects/{id}/automation/runs`
- [x] Ajouter `find_automation_run(project_id, name, source)` → filtre dans `GET .../automation/runs`
- [x] Ajouter `append_to_automation_run(run_id, fields, links)` → `POST .../append`
- [x] Ajouter `create_automation_thread(run_id)` → `POST .../threads`
- [x] Ajouter `append_test_results(thread_id, tests)` → `POST .../threads/{tid}/append` (batch)
- [x] Ajouter `complete_automation_run(run_id)` → `POST .../complete`

### P30#2 — Mapping GitLab → Testmo

- [x] Définir le mapping statuts : `opened`+`Test::TODO` → `untested`, `opened`+`Bug` → `failed`, `closed` → `passed`
- [x] Construire le `key` unique (`gitlab-{project_id}-{iid}`) et le `name` (`[#{iid}] {title}`)
- [x] Mapper les métadonnées : URL issue, labels, estimate, description tronquée → `fields`

### P30#3 — `SyncService.execute_sync()` (run creation/update)

- [x] Trouver ou créer l'automation run cible par nom/itération (source=`gitlab-sync`)
- [x] Créer un thread dans le run
- [x] Batch des résultats par lot de 50
- [x] Finalisation : compléter thread + run
- [x] Mettre à jour les labels GitLab (`Sync-Updated`) et persister `testmo_run_id`

### P30#4 — Persistance & Traçabilité

- [x] Migration `SyncRun` : ajouter `testmo_run_id` (int, nullable) + `testmo_run_url` (str, nullable)
- [x] Lien direct vers le run Testmo dans l'historique de sync

### P30#5 — Frontend (Dashboard6)

- [x] Ajouter champ optionnel **"Source"** (défaut `gitlab-sync`, paramètres avancés)
- [x] Preview : afficher le run cible (existant ou à créer) + répartition par statut
- [x] Summary SSE : afficher le lien vers le run Testmo créé/mis à jour

### P30#6 — Auto-Sync

- [x] Brancher `auto_sync_job` sur le nouveau `execute_sync` avec les paramètres configurés

### P30#7 — Tests

- [x] Tests unitaires des mappings statuts (13/13 ✅)
- [x] Tests modèles mis à jour avec `testmo_run_id`/`testmo_run_url` (51/51 ✅)
- [x] Fixture `init_db` session-scope pour création tables SQLite en test

---

## 🚀 P32 — Tech Debt Audit (Session actuelle)

> Basé sur l'audit complet disponible dans [`TECH_DEBT_AUDIT.md`](./TECH_DEBT_AUDIT.md).
> **Date :** 2026-05-04 | **Scope :** Full-stack (Node, Python, React)

### 🔴 P32#1 — Critical

- [x] **F001** — Split `testmo.service.ts` (1 537 LOC → 421 LOC facade) en `testmo/{helpers,cache,metrics,repository}.ts`
- [x] **F005** — Corriger le type guard `ApiResponse` dans `Dashboard6.tsx:316` et `:362` (utiliser `isApiSuccess()`)

### 🟠 P32#2 — High

- [x] **F002** — Split `TestClosureModal.tsx` (922 LOC) : extraire logique PDF dans hook + sous-composants
- [x] **F003** — Split `gitlab.service.ts` (920 LOC) en `GitlabRestClient`, `GitlabGraphQLClient`, `GitlabParser`
- [x] **F004** — Typer les middlewares Express (`req: any` → `Request`, `res: any` → `Response`)
- [x] **F006** — Réécrire le README.md (structure, lancement, déploiement, évolutions livrées)

### 🟡 P32#3 — Medium

- [x] **F007** — Forcer `uuid@^9` via `overrides` dans `backend/package.json` (vuln exceljs)
- [x] **F008** — Ajouter types Jest dans `frontend/tsconfig.json` (96 → 0 erreurs TS)
- [x] **F009** — Générer types API frontend depuis OpenAPI (`openapi-typescript` → `src/types/api.generated.ts`) ✅
- [x] **F010** — Fix mypy `app/models/base.py` (`explicit_package_bases = true`)
- [x] **F011/F012** — Remplacer `any` dans `Dashboard6.tsx`, `RetentionAdmin.tsx` par des interfaces
- [x] **F013** — Corriger et activer les tests frontend en CI (`vitest run`)
- [x] **F014** — Implémenter un `BrowserPool` pour Puppeteer (fuite mémoire potentielle)
- [x] **F022** — Extraire `docxGenerator.ts` (652 LOC) vers un service backend Python ou ajouter des tests
- [x] **F023** — Extraire un `ResilientHttpClient` commun (retry/circuit breaker dupliqués)
- [x] **F027** — Migrer `routes.coverage.test.js` (742 LOC) vers tests d'intégration avec SQLite in-memory
- [x] **F028** — Split `backup.service.ts` (429 LOC) en `BackupLocal`, `BackupS3`, `BackupRotation`, `BackupRestore`

### 🟢 P32#4 — Low

- [x] **F016** — Normaliser la gestion d'erreur frontend avec un hook `useApiError` ✅
- [x] **F017** — Upgrader `lucide-react@0.263.1` → `^1.14.0` ✅
- [x] **F018** — Migrer `reports/generate_R06_pptx.js` → `backend/scripts/` ✅
- [x] **F019** — Ajouter validation Zod sur `runs.routes.ts:34` (`req.query.status` via `req.validatedQuery`) ✅
- [x] **F020** — Split `calculations.test.ts` → 5 fichiers thématiques (`metrics`, `steps`, `enrichment`, `sync`, `version`) ✅
- [x] **F021** — Documenter l'import `AppRouter` via path alias `~server` (monorepo) ✅
- [x] **F024** — Fusionner `featureFlags.service.d.ts` dans `featureFlags.service.ts` + typer les `any` ✅
- [x] **F025** — Ajouter graceful shutdown WebSocket (`wss.close()` + `clearInterval(heartbeat)`) ✅
- [x] **F026** — Upgrader `marked@^4.3.0` → `^14.0.0` (compat CJS), remplacer `yamljs` par `js-yaml` ✅

---

## 🚀 P34 — Cutover Backend Node.js → Python (Session livrée)

> **Date :** 2026-05-05 | **Scope :** Backend (Node cleanup + Python activation)
> **Goal :** Rendre le backend Python (`backend_py/`) le seul backend actif pour toutes les routes `/api/sync/*`, `/api/testmo-browser/*`, `/api/crosstest/*`. Supprimer le code mort Node.js correspondant.

### Phase 1 — Port config & résolution ID (Dashboard6)

- [x] Porter `PROJECTS` config Node.js → `backend_py/app/projects_config.py` (5 projets)
- [x] `resolve_gitlab_project_id()` : mapping `"workshop-web"` → `141` + fallback numérique
- [x] Accepter `project_id: int | str` dans tous les schemas `SyncCasesPreviewPayload`, `SyncExecutePayload`, `SyncStatusPayload`

### Phase 2 — Fix routes Python

- [x] `GET /api/sync/projects` : retourne `SYNC_PROJECTS` statique au lieu de requête GitLab vide
- [x] `GET /api/sync/:project_id/iterations` : utilise `resolve_gitlab_project_id()` pour accepter les IDs logiques
- [x] `POST /api/sync/cases/preview` : résolution ID + mapping réponse frontend-compatible
- [x] `POST /api/sync/cases/execute` : résolution ID + SSE stream
- [x] `POST /api/sync/status-to-gitlab` : résolution ID avant appel service

### Phase 3 — Suppression code mort Node.js

- [x] Routes supprimées : `sync.routes.ts`, `testmoBrowser.routes.ts`, `crosstest.routes.ts`
- [x] Services supprimés : `sync.service.ts`, `status-sync.service.ts`, `testmoBrowser.service.ts`, `auto-sync-config.service.ts`
- [x] Jobs/scripts supprimés : `autoSyncJob.ts`, `run-sync.js`, `test-testmo-api.js`
- [x] tRPC routers supprimés : `sync.ts`, `crosstest.ts`, `integrations.ts`
- [x] Tests supprimés/adaptés : 11 fichiers de tests mis à jour
- [x] Fichiers centraux nettoyés : `server.ts`, `trpc/router.ts`, `health.routes.ts`, `trpc/routers/anomalies.ts`

### Phase 4 — Documentation & Validation

- [x] OpenAPI régénérée depuis FastAPI (`backend/docs/openapi.yaml` — 2730 lignes)
- [x] Tests Python : 206/206 ✅
- [x] Tests Node.js restants : 578/578 ✅
- [x] Compilation TypeScript Node.js : 0 erreur ✅
- [x] Endpoints testés : `/sync/projects`, `/sync/cases/preview`, `/sync/cases/history`, `/sync/cases/execute`

---

## 🚧 Sessions futures (P35+)

### 🔴 Haute valeur métier

#### P33#1 — Tests E2E Playwright sur le flow Cases

- [ ] Parcours complet : sélection projet → itération → preview → sync → vérification historique
- [ ] Mock GitLab + Testmo ou environnement de staging

#### P33#2 — Dashboard personnalisable par utilisateur

- [ ] Widgets déplaçables (drag-and-drop)
- [ ] Filtres sauvegardés par profil
- [ ] Vues prédéfinies : "QA Lead", "Developer", "Manager"

#### P33#3 — Alertes intelligentes (ML basique) ✅

- [x] Détection de régression automatique entre 2 itérations
- [x] Prédiction de date de fin basée sur vélocité des passes
- [x] Seuil adaptatif (pas de valeur hardcodée 85 %)

### 🟠 Tech & DX

#### P33#4 — Types tRPC auto-générés (F021)

- [ ] Générer `AppRouter` frontend depuis le bridge Python (`app/routers/trpc.py`)
- [ ] Supprimer le TODO dans `frontend/src/trpc/client.ts`

#### P33#5 — Migration SQLite → PostgreSQL

- [ ] Adapter `database.py` pour supporter `postgresql+asyncpg`
- [ ] Migrer les jobs lourds (analytics, retention) vers des requêtes SQL analytiques
- [ ] Garder SQLite pour les tests et le dev local

#### P33#6 — Cache distribué (Redis)

- [ ] Remplacer `TTLCache` en mémoire par Redis
- [ ] Permettre le scaling horizontal du backend Python

#### P33#7 — Storybook + tests visuels

- [ ] Catalogue de composants isolés
- [ ] Regression visuelle automatique (Chromatic ou Playwright screenshots)

### 🟡 Polish & Ops

#### P33#8 — Mise à jour documentation

- [x] `docs/ARCHITECTURE_PYTHON.md` : refléter l'architecture cases sync ✅ (mis à jour 2026-05-05)
- [x] `docs/DEPLOYMENT.md` : nouvelles tables et migrations Alembic ✅ (mis à jour 2026-05-05)

#### P33#9 — RBAC granulaire

- [ ] Rôles `admin` / `qa_lead` / `viewer` avec permissions différenciées
- [ ] Middleware d'autorisation par ressource

#### P33#10 — Chiffrement des tokens d'intégration

- [ ] Chiffrer `integrations.config_json` en DB (au lieu de clair)
- [ ] Rotation automatique des clés de chiffrement

---

## 📝 Analyse — Création de runs manuels Testmo (2026-04-30)

### Constat API Testmo

L'API REST officielle Testmo (v1, 2025) est **lecture seule** pour les runs manuels :

| Endpoint                         | Méthode | Type de run                           |
| -------------------------------- | ------- | ------------------------------------- |
| `/projects/{id}/runs`            | `GET`   | Manuel — lecture seule                |
| `/runs/{id}`                     | `GET`   | Manuel — lecture seule                |
| `/runs/{id}/results`             | `GET`   | Manuel — lecture seule (nouveau 2025) |
| `/projects/{id}/automation/runs` | `POST`  | **Automation** — écriture OK          |
| `/automation/runs/{id}/append`   | `POST`  | **Automation** — écriture OK          |

Source : [Testmo Blog — Announcing Runs Results API](https://www.testmo.com/blog/announcing-the-new-runs-results-api-in-testmo/) (fév 2025) :

> _"manual runs are used to track the scripted or steps-based tests that your team is running manually, and you can add results for those kinds of tests **via the Runs page in the Testmo UI**._"

### Décisions

1. **P30 (Automation Runs) est techniquement fonctionnel mais métier-incorrect.** Il reste dans le codebase pour l'instant mais ne doit pas être utilisé pour du test manuel.
2. **P31 (Cases) est la vraie cible.** Les cases sont le référentiel de tests réutilisable. L'API permet CRUD complet. C'est ce que fait déjà la Routine B en Node.js externe.
3. **Option Playwright** (automatiser l'UI Testmo pour créer des runs manuels) reste possible mais est jugée trop fragile pour l'instant.

### Todo pour demain

- [x] Décider si on garde ou supprime le code P30 (automation runs) → **Gardé en mode deprecated, masqué UI**
- [x] Coder P31 : sync des cases Testmo depuis GitLab → [`docs/plans/P31-sync-gitlab-to-testmo-cases.md`](./docs/plans/P31-sync-gitlab-to-testmo-cases.md)
- [x] Documenter le runbook E2E réel → [`docs/routines/routine-E2E-cases-real.md`](./docs/routines/routine-E2E-cases-real.md)
- [x] Exécuter le test E2E réel avec l'instance Testmo de production (itération réelle GitLab → Testmo Cases) → **Validé 2026-05-05** sur `neo-pilot/R14 - run 2`. 2 bugs corrigés (`custom_description`, sanitize tags). Voir [`docs/routines/routine-E2E-cases-real.md`](./docs/routines/routine-E2E-cases-real.md)

---

- [x] **P26 — Analytics & Insights IA** : Table `analytics_insights`, service de détection patterns (baisse pass rate, stagnation, blocage, échappement), job cron quotidien 3h, route tRPC, composant `AnalyticsPanel`, tests 6/6 ✅
- [x] **P26 — Data Retention & Archivage** : Tables `retention_policies` + `archived_snapshots`, cycle d'archivage auto par entité, job cron hebdomadaire, UI admin `/admin/retention`, tests 4/4 ✅
- [x] **P26 — Intégrations tierces** : Table `integrations`, connecteur Jira (test + création tickets), webhook générique HMAC-SHA256, UI admin `/admin/integrations`, tests 6/6 ✅
- [x] **Option B** — Tests de charge & Performance : k6, 50 users simultanés, mesure p95/p99, corrections goulots d'étranglement ✅
- [x] **P23** — Améliorations UX : raccourcis clavier, drag-and-drop tableaux, mode compact ✅
- [x] **P24** — Alerting avancé : webhooks personnalisés par métrique, templates d'alerte configurables

## ✅ Sessions livrées

- [x] **P18** — Internationalisation (i18n) FR/EN : UI, emails, templates de rapport ✅
- [x] **P19** — Pool Puppeteer optimisé : pool de 3 pages réutilisables, sémaphore concurrence, header `X-PDF-Generation-Time`, rotation fine pages + tests ✅
- [x] **P20** — WebSocket temps réel : serveur WS (`ws`) + `DashboardRoom` (polling centralisé par projectId, broadcast clients) + hook `useDashboardWebSocket` avec fallback SSE automatique + tests ✅
- [x] **P21** — Backup automatisé SQLite : cron quotidien 3h + dump VACUUM INTO + compression gzip + rotation locale 7j + upload S3 (IA) **ou rsync/SSH** + rotation distante 30j + endpoint admin `/api/admin/backups` ✅
- [x] **P22** — tRPC : couche API typée montée sur Express, 13 sous-routers backend, hooks frontend migrés, type-safety end-to-end ✅
- [x] **P23** — Améliorations UX : raccourcis clavier, drag-and-drop tableaux, mode compact ✅
- [x] **P24** — Alerting avancé : webhooks personnalisés par métrique, templates d'alerte configurables ✅
- [x] **P25** — PWA / Mobile : Service worker, offline mode, manifest, responsive des dashboards complexes ✅
- [x] **P28** — Sync GitLab avancée & Corrections : Filtres sync, fix route `/compare`, fix `/projects`, untrack fichiers générés, label custom insensible à la casse ✅
- [x] **P29** — Audit UI/UX & Design System : Accessibilité critique, design tokens, responsive, motion, navigation, charts accessibles, i18n complète des composants manquants ✅
- [x] **P30** — Sync GitLab → Testmo Automation Runs : Extension TestmoService écriture, mapping statuts, sync execute, persistance `testmo_run_id`, preview UI, auto-sync, tests 64/64 ✅
- [x] **P31** — Sync GitLab → Testmo Cases (Routine B) : `case_sync.py`, repository cases CRUD, extraction steps, folder hierarchy, routes REST `/sync/cases/*`, tRPC bridge, `SyncCaseRun` + `auto_sync_config.mode`, Dashboard6 pivot Run→Cases, tests 40+ ✅
- [x] **P32** — Tech Debt Audit : Split testmo.service.ts, TestClosureModal, gitlab.service.ts, typer middlewares, README, types API auto-générés, marked@14, js-yaml, useApiError, lucide-react@1.14.0, split calculations.test.ts, graceful shutdown WS, validation Zod runs.routes, etc. ✅

## 📝 Notes

> **Règle d'or :** Une PR = un item de cette checklist. Pas de mega-PR.

> **Ordre recommandé :** CI/CD d'abord (ça sécurise tout le reste), puis le split App.jsx, puis les tests frontend.
