# 📊 Analyse Complète et Plan d'Exécution — QA Dashboard by Kimi 2.0

**Date d'analyse :** 2026-05-13  
**Version cible :** 3.0.0  
**Auteur :** Agent IA (subtask Hermes)  
**Base :** État actuel du codebase + documents existants + historique git

---

## 1. Résumé Exécutif

### 1.1 Qu'est-ce que c'est ?

Le **QA Dashboard by Kimi 2.0** est une application fullstack de monitoring et reporting QA, conçue autour de **Testmo** (gestion de tests) et intégrée avec **GitLab** (issue tracking). L'application fournit des tableaux de bord en temps réel avec des métriques conformes aux standards **ISTQB**, **ITIL**, **LEAN** et **DevOps**.

### 1.2 Objectif

- Monitorer en continu les résultats de tests Testmo (Completion Rate, Pass Rate, Failure Rate, Test Efficiency)
- Synchroniser bidirectionnellement GitLab ↔ Testmo (création de cas de test depuis les issues GitLab, report des statuts de test vers GitLab)
- Générer des rapports multi-formats (PDF, PPTX, HTML, CSV, Excel)
- Alerter sur les violations de seuils SLA ITIL
- Fournir des vues multiples : monitoring principal, analyse de tendances, comparaison multi-projets, admin feature flags, audit log, rétention de données, intégrations externes
- Piloter les opérations quotidiennes QA (clôture de runs, validation de milestones preprod/prod, feedback sync)

### 1.3 État actuel — Vue d'ensemble

Le projet a **beaucoup évolué** depuis le rapport d'analyse initial (2026-04-22). Les changements majeurs incluent :

| Domaine              | Avant (v2.0)                               | Maintenant (v3.0)                                                                                             |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Backend              | Express/Node.js seul                       | **FastAPI Python** actif, Node.js en maintenance                                                              |
| Frontend             | JSX vanilla, pas de routing, pas de TS     | **React 18 + Vite + TypeScript + React Router**                                                               |
| State management     | Props drilling via App.jsx (532 lignes)    | Custom hooks (useTheme, useDashboard, useAuth, etc.), **TanStack React Query**                                |
| Navigation           | Bascule manuelle par state `dashboardView` | **React Router** avec lazy loading                                                                            |
| Tests backend        | ~2700 lignes Jest (6 suites)               | **206 tests Python + 578 tests Node.js**, tests E2E Playwright                                                |
| Tests frontend       | Zero                                       | **Vitest + React Testing Library** (AppLayout.test.tsx, etc.)                                                 |
| Auth                 | Aucune                                     | **OAuth2 GitLab + JWT** avec dev-login bypass                                                                 |
| API                  | REST Express seul                          | REST FastAPI + **tRPC bridge Python** (13 domaines) + WebSocket + SSE                                         |
| Monitoring           | Health check basique                       | **Prometheus metrics** + **Sentry SDK** + health checks complets (Testmo, GitLab, DB, disk, circuit breakers) |
| DB                   | better-sqlite3 seul                        | **SQLAlchemy 2.0 + Alembic**, support **PostgreSQL** (asyncpg)                                                |
| CI/CD                | Aucun                                      | **GitHub Actions CI**, Husky + lint-staged                                                                    |
| Docker               | Aucun                                      | **docker-compose.yml** (production) + **docker-compose.dev.yml** (dev) + Makefile                             |
| Internationalisation | Aucune                                     | **i18n FR/EN** via react-i18next                                                                              |

---

## 2. Architecture Technique

### 2.1 Architecture globale

```
┌──────────────────────────────────────────────────────┐
│                    QA Dashboard 3.0                    │
├──────────────┬──────────────────┬─────────────────────┤
│  Frontend    │   Backend Py     │  Backend Node (legacy│
│  React 18    │   FastAPI :3001  │  Express (maint.)   │
│  Vite + TS   │                  │                     │
│  Port :3000  │                  │                     │
├──────────────┼──────────────────┼─────────────────────┤
│  • TypeScript│  • 24 routers    │  • 1 router restant │
│  • React Rtr │  • tRPC bridge   │  • Routes dashboard │
│  • TanStack Q│  • SQLAlchemy DB │    /runs/projects   │
│  • Chart.js  │  • 206 tests     │  • 578 tests Jest   │
│  • i18n FR/EN│  • Prometheus    │  • Maintenance      │
│  • Auth OAuth│  • Sentry        │                     │
│  • Vitest    │  • 13 API ext.   │                     │
└──────────────┴──────────────────┴─────────────────────┘
         │               │
         └─── Proxy ─────┘
              ↓
    ┌─────────────────┐
    │ Testmo API      │  ← API externe de gestion de tests
    │ GitLab API      │  ← API externe de suivi d'issues
    │ Jira (option)   │  ← Intégration externe possible
    └─────────────────┘
```

### 2.2 Stack technique détaillée

#### Frontend (`frontend/`)

| Couche              | Technologie                | Version                 |
| ------------------- | -------------------------- | ----------------------- |
| Framework           | React                      | 18.2.0 + TypeScript 6.0 |
| Build               | Vite                       | 8.0.x                   |
| Routing             | React Router DOM           | 6.22.0                  |
| State/Cache HTTP    | TanStack React Query       | 5.100.x                 |
| Tableaux de données | TanStack React Table       | 8.21.x                  |
| Virtualisation      | TanStack React Virtual     | 3.13.x                  |
| API type-safe       | tRPC client                | 11.17.0                 |
| HTTP                | Axios                      | 1.6.5                   |
| Graphiques          | Chart.js + react-chartjs-2 | 4.4.1 / 5.2.0           |
| Drag & Drop         | @dnd-kit                   | 6.3.x                   |
| Icons               | lucide-react               | 1.14.0                  |
| Export              | html2canvas + jspdf + docx | diverses                |
| i18n                | react-i18next              | 17.0.6                  |
| Monitoring          | Sentry SDK React           | 10.49.0                 |
| Tests               | Vitest + RTL               | 4.1.5 + 14.2.1          |

#### Backend Python (`backend_py/`)

| Couche             | Technologie                              | Version                       |
| ------------------ | ---------------------------------------- | ----------------------------- |
| Runtime            | Python                                   | ≥ 3.12                        |
| Framework web      | FastAPI                                  | 0.115+                        |
| Async ASGI         | Uvicorn                                  | 0.32+                         |
| ORM                | SQLAlchemy                               | 2.0+                          |
| Migrations         | Alembic                                  | 1.14+                         |
| Validation données | Pydantic                                 | 2.9+ / pydantic-settings 2.6+ |
| Base de données    | SQLite (dev) / PostgreSQL asyncpg (prod) | —                             |
| HTTP client        | httpx + tenacity (retry)                 | —                             |
| Cron/Scheduler     | APScheduler                              | 3.10+                         |
| Auth               | PyJWT + passlib[bcrypt]                  | —                             |
| Cache              | cachetools + cache mémoire               | —                             |
| Rate limiting      | slowapi                                  | 0.1.9+                        |
| Monitoring         | Prometheus + Sentry SDK                  | —                             |
| Logging            | structlog                                | 24.4+                         |
| Reports            | python-pptx + openpyxl + jinja2          | —                             |
| PDF                | Playwright (headless browser)            | 1.48+                         |
| Webhooks           | boto3 + aiobotocore (S3)                 | —                             |
| Tests              | pytest + pytest-asyncio                  | 8.3+                          |
| Linting            | ruff + mypy                              | 0.8+ / 1.13+                  |

#### Backend Node.js legacy (`backend/`)

| Couche    | Technologie              |
| --------- | ------------------------ |
| Runtime   | Node.js 22+              |
| Framework | Express 5.x              |
| Tests     | Jest 29.7 (578 tests)    |
| tRPC      | Serveur natif TypeScript |

#### Infrastructure

| Couche           | Technologie                |
| ---------------- | -------------------------- |
| Containerisation | Docker + docker-compose    |
| CI/CD            | GitHub Actions             |
| Pre-commit       | Husky + lint-staged        |
| Reverse proxy    | Nginx (container frontend) |

### 2.3 Structure du projet mise à jour

```
qa-dashboard version light by kimi/
├── backend/                   # Node/Express (legacy, maintenance)
│   ├── services/              # Services métier TS
│   ├── routes/                # Routes REST Express
│   ├── trpc/                  # Router tRPC natif
│   ├── middleware/            # Middleware auth, audit
│   ├── jobs/                  # Jobs cron
│   ├── tests/                 # 578 tests Jest
│   └── server.ts              # Point d'entrée
│
├── backend_py/                # FastAPI Python (backend actif)
│   ├── app/
│   │   ├── main.py            # Entrée FastAPI, lifespan, 25 routers
│   │   ├── config.py          # pydantic-settings (DATABASE_URL, JWT, etc.)
│   │   ├── database.py        # SQLAlchemy async, SQLite/PostgreSQL auto
│   │   ├── schemas.py         # Schémas Pydantic partagés
│   │   ├── deps.py            # Dépendances FastAPI (get_db, etc.)
│   │   ├── constants.py       # Constantes métier
│   │   ├── core/              # Security, circuit breaker, resilience
│   │   ├── routers/           # 25 routers REST (health, auth, dashboard, runs, sync, etc.)
│   │   │   └── trpc/          # tRPC bridge Python (13 domaines)
│   │   ├── services/          # ~27 services métier (testmo, gitlab, sync, report, etc.)
│   │   ├── models/            # SQLAlchemy models
│   │   ├── jobs/              # Scheduler APScheduler + jobs cron
│   │   └── utils/             # Helpers
│   ├── tests/                 # 206 tests pytest
│   ├── db-data/               # SQLite databases persistés
│   └── pyproject.toml
│
├── frontend/                  # React + Vite + TypeScript
│   ├── src/
│   │   ├── App.tsx            # 238 lignes (orchestrateur principal)
│   │   ├── main.tsx           # Point d'entrée React
│   │   ├── components/        # ~50+ composants TSX
│   │   │   ├── AppLayout.tsx       # Layout principal
│   │   │   ├── AppRouter.tsx       # Router lazy-loaded
│   │   │   ├── Dashboard4.tsx      # Vue d'ensemble (Global View)
│   │   │   ├── Dashboard5.tsx      # Vue qualité
│   │   │   ├── Dashboard6.tsx      # Sync GitLab → Testmo
│   │   │   ├── Dashboard7.tsx      # CrossTest / Issues
│   │   │   ├── Dashboard8.tsx      # Auto-sync panel
│   │   │   ├── GlobalViewDashboard.tsx
│   │   │   ├── MultiProjectDashboard.tsx
│   │   │   ├── CompareDashboard.tsx
│   │   │   ├── HistoricalTrends.tsx
│   │   │   ├── ToolsPage.tsx
│   │   │   ├── FeedbackSyncDashboard.tsx
│   │   │   ├── NotificationSettings.tsx
│   │   │   ├── FeatureFlagsAdmin.tsx
│   │   │   ├── AnalyticsPanel.tsx
│   │   │   ├── AuditLogViewer.tsx
│   │   │   ├── RetentionAdmin.tsx
│   │   │   ├── IntegrationsAdmin.tsx + .test.tsx
│   │   │   ├── TestClosureModal.tsx
│   │   │   ├── ReportGeneratorModal.tsx
│   │   │   ├── ConfigurationScreen.tsx
│   │   │   ├── AlertTemplates.tsx
│   │   │   ├── sync/*.tsx         # SyncPreviewPanel, SyncConfigPanel, SyncProgressPanel
│   │   │   ├── layout/*.tsx       # TopBar, MobileDrawerContent, ExportMenu
│   │   │   └── ...                # MetricCard, Toast, Breadcrumb, etc.
│   │   ├── hooks/             # Custom hooks (useTheme, useDashboard, useAuth, useAutoRefresh, etc.)
│   │   ├── services/          # api.service.ts, http.config.ts, api/
│   │   ├── trpc/              # Client tRPC TypeScript
│   │   ├── types/             # Types partagés (api.types.ts)
│   │   ├── lib/               # queryClient (TanStack Query)
│   │   ├── i18n/              # Locales (fr.json, en.json)
│   │   └── styles/            # CSS
│   ├── dist/                  # Build production (PWA ready)
│   └── package.json
│
├── docs/                      # Documentation étendue
│   ├── ARCHITECTURE.md        # Architecture Node.js
│   ├── ARCHITECTURE_PYTHON.md # Architecture FastAPI
│   ├── DEPLOYMENT.md          # Guide déploiement
│   ├── TROUBLESHOOTING.md     # Dépannage
│   ├── UI_UX_AUDIT.md         # Audit UI/UX
│   ├── MIGRATION_REACT_QUERY_TYPESCRIPT.md
│   ├── plans/                 # Plans d'exécution (P31, P34)
│   ├── routines/              # Routines Claude
│   └── superpowers/           # Plans et specs détaillées
│
├── e2e/                       # Tests Playwright
├── docker-compose.yml         # Production
├── docker-compose.dev.yml     # Développement
├── Makefile                   # Orchestration Docker
├── package.json               # Monorepo (workspaces: backend, frontend)
├── CLAUDE.md                  # Guide pour agents IA
├── README.md                  # Documentation principale
├── QUICK_START.md             # Démarrage rapide
├── DOCKER_CHEATSHEET.md       # Aide Docker
├── ROADMAP_EXECUTION.md       # Suivi avancement tâches
└── RAPPORT_ANALYSE_QA_DASHBOARD.md # Analyse initiale (2026-04-22)
```

---

## 3. Analyse des Composants

### 3.1 Backend Python FastAPI (`backend_py/`)

**État :** Actif en production, backend principal.

**Architecture :**

- Point d'entrée : `app/main.py` — FastAPI avec lifespan management, 25 routers, middleware Prometheus, CORS, GZip, rate limiting (slowapi), endpoint /metrics protégé
- Configuration : `app/config.py` — pydantic-settings centralisé (DATABASE_URL, SECRET_KEY, JWT, Testmo, GitLab, SMTP, Sentry, etc.)
- Base de données : `app/database.py` — SQLAlchemy async avec détection automatique SQLite/PostgreSQL, init idempotent, deux bases (main + comments)

**Routers REST (25) :**

| Router           | Préfixe               | Description                           |
| ---------------- | --------------------- | ------------------------------------- |
| `health`         | `/api/health`         | Health check (ready, detailed)        |
| `auth`           | `/api/auth`           | OAuth2 GitLab, JWT, dev-login         |
| `projects`       | `/api/projects`       | Projets Testmo                        |
| `dashboard`      | `/api/dashboard`      | Métriques ISTQB, SSE                  |
| `runs`           | `/api/runs`           | Détails des runs                      |
| `sync`           | `/api/sync`           | Sync GitLab ↔ Testmo (cases + status) |
| `crosstest`      | `/api/crosstest`      | CrossTest CRUD                        |
| `export`         | `/api/export`         | Export CSV/Excel                      |
| `pdf`            | `/api/pdf`            | Génération PDF via Playwright         |
| `reports`        | `/api/reports`        | Rapports HTML/PPTX                    |
| `notifications`  | `/api/notifications`  | Notifications multi-canaux            |
| `feature-flags`  | `/api/feature-flags`  | Feature flags CRUD                    |
| `webhooks`       | `/api/webhooks`       | Webhooks sortants HMAC                |
| `audit`          | `/api/audit`          | Audit logging                         |
| `anomalies`      | `/api/anomalies`      | Détection anomalies                   |
| `cache`          | `/api/cache`          | Cache management                      |
| `backups`        | `/api/admin/backups`  | Backup (local/S3/rsync)               |
| `docs`           | `/api/docs`           | Documentation API                     |
| `metrics`        | `/api/metrics`        | Prometheus metrics                    |
| `analytics`      | `/api/analytics`      | Analytics avancés                     |
| `retention`      | `/api/retention`      | Politique de rétention                |
| `integrations`   | `/api/integrations`   | Jira, GitLab, etc.                    |
| `testmo-browser` | `/api/testmo-browser` | Testmo browser automation             |
| `feedback-sync`  | `/api/feedback-sync`  | Scan runs → tickets GitLab            |
| `websocket`      | `/ws`                 | WebSocket temps réel                  |

**Bridge tRPC (13 domaines) :** `app/routers/trpc/` — analytics, anomalies, cache, crosstest, dashboard, feature_flags, integrations, notifications, projects, reports, retention, sync, webhooks

**Services métier (~27) :**

- `testmo.py` / `testmo_client.py` / `testmo_metrics.py` — Client Testmo, métriques ISTQB, KPIs, SLA
- `gitlab.py` / `gitlab_connector.py` — Intégration GitLab (GraphQL + REST)
- `sync.py` / `case_sync.py` / `status_sync.py` — Synchro bidirectionnelle
- `feedback_sync.py` — Scan runs Testmo → création tickets GitLab (NOUVEAU)
- `alerting.py` / `smart_alerts.py` — Alertes et détection de régressions
- `anomaly.py` / `analytics.py` — Détection anomalies et analytics
- `export.py` — Export CSV/Excel
- `pdf.py` — Génération PDF Playwright headless
- `report/` — Rapports HTML, PPTX, collecte de données
- `backup.py` — Backup (local, S3, rsync)
- `jira.py` — Intégration Jira
- `retention.py` — Politique de rétention de données
- `webhook_emitter.py` — Émission webhooks HMAC-SHA256

**Jobs cron (Scheduler APScheduler) :**

- `scheduler.py` — Orchestration APScheduler
- `feedback_sync.py` — Job de synchronisation feedback
- `metrics_snapshot.py` — Snapshot périodique des métriques

### 3.2 Frontend React (`frontend/`)

**État :** Fortement modernisé depuis l'analyse initiale.

**Architecture :**

- `App.tsx` (238 lignes) — Orchestrateur principal, utilise des custom hooks pour déléguer le state. Délègue le routing à `AppRouter` et le layout à `AppLayout`. A été réduit de 532 à 238 lignes grâce aux hooks.
- `AppRouter.tsx` (95 lignes) — Router React Router DOM avec **lazy loading** de tous les dashboards secondaires via `React.lazy()` + `Suspense`
- `AppLayout.tsx` — Layout principal avec header, navigation, modals export, gestion dark/tv/compact mode

**Hooks personnalisés :**

- `useDashboard` — Chargement métriques, projets, health check, circuit breakers
- `useTheme` — Dark mode, TV mode, compact mode (persisté localStorage)
- `useAuth` — Authentification OAuth2 GitLab, état connexion, admin
- `usePreferences` — Termes métier, auto-refresh toggle
- `useAutoRefresh` — Rafraîchissement périodique
- `useToast` — Système de notifications toast
- `useCompactMode` — Mode compact

**Composants principaux (50+) :**

- Dashboards 4-8 (vues principales)
- GlobalViewDashboard, MultiProjectDashboard, CompareDashboard
- HistoricalTrends, AnalyticsPanel
- FeedbackSyncDashboard (NOUVEAU)
- ToolsPage (sélection milestones preprod/prod)
- Admin : FeatureFlagsAdmin, AuditLogViewer, RetentionAdmin, IntegrationsAdmin
- Sync : Dashboard6 (sync GitLab→Testmo), Dashboard7 (CrossTest), SyncPreviewPanel, SyncConfigPanel, SyncProgressPanel, SyncHistoryPanel, SyncLogParts
- UI : AppLayout, AppRouter, AppRouter, Toast, MetricCard, TrendBadge, Breadcrumb, MobileBottomNav, MobileDrawer, ExportFAB, ExportMenu
- Modals : TestClosureModal, ReportGeneratorModal, QuickClosureModal, TestClosurePDFTemplates
- ConfigurationScreen, AlertTemplates, NotificationSettings, NotificationChannels, WebhookSubscriptions

**Tests frontend :**

- `AppLayout.test.tsx`
- `MetricCard.test.tsx`
- `IntegrationsAdmin.test.tsx`
- `MobileBottomNav.test.tsx`

### 3.3 Backend Node.js Legacy (`backend/`)

**État :** En maintenance, uniquement pour les routes non encore coupées (dashboard, runs, projects, reports).

- **735/578 tests Jest** passent
- Serveur tRPC natif TypeScript toujours présent
- Services métier TypeScript (testmo, gitlab, sync, etc.)
- Routes REST Express

**Routes restantes en Node.js :** dashboard, runs, projects, reports (toutes les autres ont été coupées vers Python)

### 3.4 Base de données

- **SQLite** (dev/local) : Deux bases — `main` (métier) + `comments` (CrossTest)
- **PostgreSQL** (prod) : Supporté via `DATABASE_URL` + asyncpg
- **Alembic** : Migrations gérées automatiquement
- Détection auto du type de DB au démarrage

### 3.5 Authentification

- **OAuth2 GitLab** + **JWT** pour l'authentification
- **Dev-login bypass** pour le développement local
- Protection des routes admin
- Auto token refresh

### 3.6 Monitoring et Observabilité

- **Prometheus** : Métriques HTTP (duration, total, errors), endpoint `/metrics` protégé par clé secrète
- **Sentry SDK** : Tracking d'erreurs en production (DSN configurable)
- **Health checks** : `/api/health/ready` (Kubernetes-style 503), `/api/health/detailed` (Testmo, GitLab, DB, disk, circuit breakers)
- **Structured logging** : structlog avec contexte métier

### 3.7 Docker

- `docker-compose.yml` : Production (backend Py + Nginx frontend, port 8080)
- `docker-compose.dev.yml` : Développement avec hot-reload
- **Makefile** : Cibles dev, prod, stop, clean, logs, test, lint, build, ps, shell
- `.dockerignore` créé pour `backend_py/`

---

## 4. Fonctionnalités Implantées vs Prévues

### 4.1 Fonctionnalités implantées ✅

| #   | Fonctionnalité                                            | Statut                                       |
| --- | --------------------------------------------------------- | -------------------------------------------- |
| 1   | 4 KPIs ISTQB (Completion, Pass, Failure, Test Efficiency) | ✅ Complet                                   |
| 2   | Graphiques visuels (Doughnut, Bar)                        | ✅                                           |
| 3   | Suivi des runs avec métriques détaillées                  | ✅                                           |
| 4   | Alertes SLA ITIL                                          | ✅ (smart alerts + alerting)                 |
| 5   | Auto-refresh périodique                                   | ✅ (configurable via hook)                   |
| 6   | Sync GitLab → Testmo (création de cas depuis issues)      | ✅ (case_sync.py)                            |
| 7   | Sync Testmo → GitLab (status → labels)                    | ✅ (status_sync.py)                          |
| 8   | Feedback Sync (scan runs → tickets GitLab)                | ✅ **NOUVEAU**                               |
| 9   | Export PDF/PPTX/HTML/CSV/Excel                            | ✅ Complet                                   |
| 10  | Rapports R06 (PPTX/DOCX-style)                            | ✅                                           |
| 11  | Notifications multi-canaux (email, Slack, Teams)          | ✅                                           |
| 12  | Graphiques de tendances historiques                       | ✅ (HistoricalTrends)                        |
| 13  | Authentification OAuth2 GitLab + JWT                      | ✅                                           |
| 14  | Support multi-projets (comparateur radar)                 | ✅ (CompareDashboard, MultiProjectDashboard) |
| 15  | TypeScript complet frontend                               | ✅                                           |
| 16  | i18n FR/EN                                                | ✅                                           |
| 17  | tRPC typé end-to-end (bridge Python)                      | ✅ (13 domaines)                             |
| 18  | Feature flags avec rollout                                | ✅                                           |
| 19  | Webhooks sortants HMAC-SHA256                             | ✅                                           |
| 20  | Audit logging complet                                     | ✅                                           |
| 21  | Health checks avancés + Prometheus                        | ✅                                           |
| 22  | PWA / Mobile responsive                                   | ✅ (MobileBottomNav, MobileDrawer)           |
| 23  | Docker + docker-compose                                   | ✅                                           |
| 24  | Dark mode + TV mode + Compact mode                        | ✅                                           |
| 25  | CrossTest (CRUD commentaires SQLite)                      | ✅                                           |
| 26  | WebSocket temps réel                                      | ✅                                           |
| 27  | Circuit Breaker + Resilience                              | ✅                                           |
| 28  | Auto-sync configurable à chaud                            | ✅                                           |
| 29  | Backup (local/S3/rsync)                                   | ✅                                           |
| 30  | Anomaly detection + Analytics                             | ✅                                           |
| 31  | Politique de rétention de données                         | ✅ (RetentionAdmin)                          |
| 32  | Intégrations (Jira, GitLab)                               | ✅                                           |
| 33  | Testmo Browser (runs manuels via Playwright)              | ✅                                           |
| 34  | Drag & Drop (dnd-kit)                                     | ✅                                           |
| 35  | Clôture de test (TestClosureModal)                        | ✅                                           |
| 36  | Support PostgreSQL (asyncpg)                              | ✅                                           |
| 37  | Migration Node→Python (P34 parité fonctionnelle)          | ✅ Complète                                  |
| 38  | Tests backend (206 pytest + 578 Jest)                     | ✅                                           |
| 39  | Tests frontend (Vitest + RTL)                             | ✅ (commencé)                                |
| 40  | CI GitHub Actions                                         | ✅                                           |
| 41  | Husky + lint-staged                                       | ✅                                           |
| 42  | Sentry SDK (frontend + backend)                           | ✅                                           |
| 43  | Drag & Drop sortable                                      | ✅                                           |

### 4.2 Fonctionnalités en cours / partielles

| #   | Fonctionnalité                     | Statut      | Remarque                                         |
| --- | ---------------------------------- | ----------- | ------------------------------------------------ |
| 1   | Couverture tests frontend          | 🟡 Partiel  | 4 fichiers test.tsx sur 50+ composants           |
| 2   | Couverture tests E2E Playwright    | 🟡 Partiel  | Compatible mais pas tous les scénarios           |
| 3   | Suppression complète Node.js       | 🟡 En cours | Routes dashboard/runs/projects/reports restantes |
| 4   | Suppression `frontend/src/server/` | 🟡 En cours | Bloqué par type `AppRouter` tRPC                 |

### 4.3 Fonctionnalités prévues / roadmap

| #   | Fonctionnalité                      | Priorité      | Remarque                               |
| --- | ----------------------------------- | ------------- | -------------------------------------- |
| 1   | Découplage complet Node.js          | 🔴 Critique   | Dernier chantier P34                   |
| 2   | Extension couverture tests frontend | 🔴 Haute      | Prioriser composants purs d'abord      |
| 3   | Tests d'intégration API backend     | 🟠 Moyenne    | supertest / httpx sur routes critiques |
| 4   | OpenAPI → types TS auto-générés     | 🟡 Recommandé | Migration de type-only legacy          |
| 5   | Tests E2E complets Playwright       | 🟡 Recommandé | Scénarios critiques de sync            |
| 6   | Optimisation bundle frontend        | 🟡 Recommandé | manualChunks Vite                      |
| 7   | Accessibilité (ARIA)                | 🟡 Recommandé | Audit UI/UX documenté                  |

---

## 5. Problèmes Identifiés et Bugs Connus

### 5.1 Critiques 🔴

| #     | Problème                                                                                                                                                          | Impact | Fichiers concernés            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------- |
| 5.1.1 | **Backend Node.js non décommissionné** — Routes dashboard/runs/projects/reports encore actives en Node.js. Risque de divergence et maintenance double.            | Élevé  | `backend/` (routes, services) |
| 5.1.2 | **`frontend/src/server/` dead code (28 fichiers)** — Services, tRPC routers, middleware TypeScript non utilisés. Bloqué par le type `AppRouter` côté client tRPC. | Élevé  | `frontend/src/server/`        |

### 5.2 Importants 🟠

| #     | Problème                                                                                                                                 | Impact | Fichiers concernés                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------ |
| 5.2.1 | **Couverture tests frontend faible** — Seulement 4 fichiers `.test.tsx` sur 50+ composants. Risque élevé de régression lors de refactor. | Élevé  | `frontend/src/components/*.test.tsx` |
| 5.2.2 | **Trop de routers REST (25)** — Le nombre élevé de routers peut rendre la maintenance et les tests plus complexes.                       | Moyen  | `backend_py/app/routers/`            |
| 5.2.3 | **Base SQLite en production** — Le docker-compose utilise SQLite (volume local). PostgreSQL supporté mais pas activé par défaut.         | Moyen  | `docker-compose.yml`, `config.py`    |
| 5.2.4 | **Pas de cache distribué** — Cache en mémoire (cachetools), invalide en cas de scaling horizontal.                                       | Moyen  | `testmo_client.py`                   |

### 5.3 Recommandés 🟡

| #     | Problème                                                                                                                                                                                                 | Impact | Fichiers concernés         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------- |
| 5.3.1 | **Bundle frontend potentiellement lourd** — Pas de `manualChunks` dans Vite. html2canvas + jspdf + docx chargés au démarrage.                                                                            | Moyen  | `frontend/vite.config.ts`  |
| 5.3.2 | **Drilling de props persistant** — Malgré les hooks, `AppLayout` reçoit encore 30+ props, `AppRouter` en reçoit 10+.                                                                                     | Moyen  | `App.tsx`, `AppLayout.tsx` |
| 5.3.3 | **Accessibilité incomplète** — Pas d'attributs ARIA sur les éléments interactifs. Audit documenté mais pas implémenté.                                                                                   | Moyen  | Frontend global            |
| 5.3.4 | **Incohérence documentation** — README dit auto-refresh 1 min, code peut avoir d'autres valeurs.                                                                                                         | Faible | `README.md` vs code        |
| 5.3.5 | **Mapping Testmo status IDs mal documenté dans testmo.py** — Les compteurs `status1_count` à `status7_count` sont utilisés sans commentaire clair (amélioration partiellement faite par commit 2d5ff24). | Faible | `testmo.py`                |

### 5.4 Résolus depuis l'analyse initiale ✅

| #                                      | Problème initial (2026-04-22) | Statut                                                       | Solution |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------ | -------- |
| `server.js` monolithique (1131 lignes) | ✅ Résolu                     | Backend réécrit en Python FastAPI avec 25 routers modulaires |
| `App.jsx` monolithique (532 lignes)    | ✅ Résolu                     | Refactoré en `App.tsx` (238 lignes) avec hooks et routing    |
| Pas de routing                         | ✅ Résolu                     | React Router DOM avec lazy loading                           |
| Pas de state management                | ✅ Résolu                     | Custom hooks + TanStack React Query                          |
| Pas de tests frontend                  | ✅ Partiellement              | Vitest + RTL, 4 fichiers test, besoin d'extension            |
| Pas d'auth                             | ✅ Résolu                     | OAuth2 GitLab + JWT                                          |
| Pas de TypeScript frontend             | ✅ Résolu                     | Migration TypeScript complète                                |
| Pas de CI/CD                           | ✅ Résolu                     | GitHub Actions CI                                            |
| Pas de Docker                          | ✅ Résolu                     | docker-compose + Makefile                                    |
| Pas d'i18n                             | ✅ Résolu                     | react-i18next FR/EN                                          |
| Pas de monitoring                      | ✅ Résolu                     | Prometheus + Sentry + health checks                          |
| Pas de WebSocket                       | ✅ Résolu                     | WebSocket route + SSE                                        |
| Recharts inutilisé                     | ✅ Résolu                     | Supprimé des dépendances                                     |
| alert()/confirm() natifs               | ✅ Résolu                     | Système Toast + modals                                       |
| Pas de pre-commit                      | ✅ Résolu                     | Husky + lint-staged                                          |

---

## 6. Recommandations et Plan d'Action Priorisé

### 6.1 Critique (P0 — Faire immédiatement)

#### 🔴 P0-1 : Découplage complet du backend Node.js

Le backend Node.js ne sert plus que les routes dashboard, runs, projects et reports. Ces routes doivent être portées en Python pour permettre le décommission complet du Node.js.

**Actions :**

1. Portage des 4 routes REST restantes en FastAPI
2. Mise à jour du proxy frontend vers Python uniquement
3. Tests sur les routes migrantes
4. Décommission Node.js (archive 1 mois)
5. Switch docker-compose vers `backend_py/` uniquement

**Effort estimé :** 2-3 jours

#### 🔴 P0-2 : Nettoyage `frontend/src/server/` dead code

28 fichiers TypeScript inutilisés occupent l'espace et créent de la confusion.

**Actions :**

1. Extraire le type `AppRouter` nécessaire au client tRPC dans un type stub
2. Supprimer `frontend/src/server/`
3. Mettre à jour les imports tRPC
4. Commit

**Effort estimé :** 0.5 jour

### 6.2 Haute Priorité (P1 — Cette semaine)

#### 🟠 P1-1 : Extension de la couverture des tests frontend

Prioriser les composants purs et les hooks critiques.

**Plan de test :**

1. **Semaine 1 :** MetricCard, Toast, Breadcrumb, TrendBadge (composants purs simples)
2. **Semaine 2 :** useDashboard, useTheme, useAuth (hooks)
3. **Semaine 3 :** AppLayout, AppRouter (composants composés)
4. **Semaine 4 :** Dashboard4, Dashboard5, Dashboard6 (dashboards principaux)

**Objectif :** 50% de couverture des composants en 4 semaines

**Effort estimé :** 2-3 semaines

#### 🟠 P1-2 : Tests d'intégration API backend

Ajouter des tests httpx sur les routes critiques du backend Python.

**Routes prioritaires :**

1. `/api/dashboard/:projectId` — Métriques ISTQB
2. `/api/sync/` — Sync GitLab ↔ Testmo
3. `/api/auth/` — Authentification
4. `/api/health/` — Health checks

**Effort estimé :** 2-3 jours

### 6.3 Moyenne Priorité (P2 — Dans 2-4 semaines)

#### 🟡 P2-1 : Optimisation du bundle frontend

**Actions :**

1. Configurer `manualChunks` dans Vite pour séparer les librairies lourdes
2. Vérifier que le lazy loading fonctionne pour tous les dashboards administratifs
3. Mesurer le bundle size avant/après

#### 🟡 P2-2 : Réduction du drilling props

**Actions :**

1. Créer un `AppContext` pour les données communes (projectId, projects, metrics, dark mode)
2. Réduire les props d'`AppLayout` de 30+ à moins de 15
3. Utiliser le context dans les dashboards enfants

#### 🟡 P2-3 : Accessibilité (ARIA)

**Actions :**

1. Implémenter les recommandations de l'audit UI/UX (`docs/UI_UX_AUDIT.md`)
2. Ajouter `role`, `aria-label`, `aria-live` sur les éléments clés
3. Tester avec un lecteur d'écran

### 6.4 Long terme (P3 — Dans 1-3 mois)

#### 🟢 P3-1 : Migration vers PostgreSQL en production

**Actions :**

1. Configurer `DATABASE_URL` pour PostgreSQL
2. Migrations Alembic pour PostgreSQL
3. Tests de performance avant/après
4. Mise en production

#### 🟢 P3-2 : Cache distribué (Redis)

Envisager Redis si le backend passe en scaling horizontal.

#### 🟢 P3-3 : OpenAPI → types TypeScript auto-générés

Remplacer le type-only legacy par des types générés depuis l'OpenAPI de FastAPI.

---

## 7. Roadmap Mise à Jour

### Phase 1 — 🔴 Découplage Node.js (Semaines 1-2)

| Semaine | Actions                                          | Livrables                         |
| ------- | ------------------------------------------------ | --------------------------------- |
| S1      | Portage routes dashboard/runs/projects en Python | Routers Python                    |
| S2      | Tests, cutover, décommission Node.js             | Docker mono-backend, zéro Node.js |

### Phase 2 — 🟠 Consolidation qualité (Semaines 3-6)

| Semaine | Actions                                         | Livrables                             |
| ------- | ----------------------------------------------- | ------------------------------------- |
| S3      | Tests frontend : composants purs                | 10-15 fichiers .test.tsx              |
| S4      | Tests frontend : hooks                          | Tests useDashboard, useTheme, useAuth |
| S5      | Tests intégration API backend                   | 20-30 tests httpx                     |
| S6      | Tests E2E Playwright (scénarios critiques sync) | Suite E2E fonctionnelle               |

### Phase 3 — 🟡 Optimisation et UX (Semaines 7-9)

| Semaine | Actions                                   | Livrables                    |
| ------- | ----------------------------------------- | ---------------------------- |
| S7      | Optimisation bundle Vite (manualChunks)   | Bundle size réduit de 20-30% |
| S8      | Context React pour réduire drilling props | AppLayout < 15 props         |
| S9      | Accessibilité ARIA                        | Audit a11y validé            |

### Phase 4 — 🟢 Production-ready (Semaines 10-12)

| Semaine | Actions                                | Livrables                    |
| ------- | -------------------------------------- | ---------------------------- |
| S10     | Migration PostgreSQL (prod)            | DB PostgreSQL opérationnelle |
| S11     | Cache Redis (si besoin de scale)       | Redis configuré              |
| S12     | Documentation complète + release notes | v3.0.0 officielle            |

---

## 8. Indicateurs de Maturité Mis à Jour

| Axe                   | Niveau (Avant)       | Niveau (Maintenant) | Justification                                                          |
| --------------------- | -------------------- | ------------------- | ---------------------------------------------------------------------- |
| Architecture backend  | 🟡 Mature avec dette | 🟢 **Mature**       | FastAPI, 25 routers, tRPC bridge, SQLAlchemy, design pattern clair     |
| Architecture frontend | 🔴 Immature          | 🟢 **Mature**       | React Router, TypeScript, hooks custom, TanStack Query, lazy loading   |
| Qualité code backend  | 🟢 Mature            | 🟢 **Mature**       | Validation Pydantic, retry logic, cache, structlog, rate-limiting      |
| Qualité code frontend | 🟡 Moyenne           | 🟢 **Bon**          | TypeScript, composants fonctionnels, hooks séparés, CSS organisé       |
| Couverture de tests   | 🟡 Dissymétrique     | 🟢 **Bon**          | 206 pytest + 578 Jest + Vitest RTL (en cours d'expansion)              |
| Performance           | 🟡 Acceptable        | 🟢 **Bon**          | Lazy loading, GZip, cache, TanStack Query, Gzip middleware             |
| Sécurité              | 🟡 Basique           | 🟢 **Bon**          | OAuth2 + JWT, rate-limiting, CORS struct, rate-limiting auth endpoints |
| UX / Accessibilité    | 🔴 Faible            | 🟡 **Moyen**        | Navigation URL, responsive mobile, mais ARIA incomplet                 |
| Documentation         | 🟢 Excellente        | 🟢 **Excellente**   | README, CLAUDE.md, plans, specs, routines, cheatsheets                 |
| DevEx / Tooling       | 🔴 Minimal           | 🟢 **Bon**          | Husky, lint-staged, ruff, eslint, CI GitHub Actions, Makefile          |
| Observabilité         | 🟠 Basique           | 🟢 **Bon**          | Prometheus, Sentry, health checks complets, structured logging         |
| Déploiement           | 🔴 Aucun             | 🟢 **Bon**          | Docker compose, Makefile, Nginx reverse proxy                          |

---

## 9. Synthèse

### Le projet a fait un bond en avant considérable

Depuis l'analyse initiale de 2026-04-22, **la grande majorité des problèmes critiques a été résolue** :

- Le backend a été réécrit en **FastAPI Python** avec 25+ routers modulaires, tRPC bridge, WebSocket, et un support PostgreSQL
- Le frontend a migré vers **TypeScript + React Router + TanStack Query**, avec 238 lignes d'App.tsx au lieu de 532
- L'**authentification OAuth2**, l'**i18n**, le **monitoring**, le **Docker**, la **CI/CD**, les **pre-commit hooks** ont tous été ajoutés
- **206 tests Python + 578 tests Node.js + tests Vitest** couvrent désormais une partie significative du code
- Le **feedback sync** (scann de runs Testmo vers tickets GitLab) est une toute nouvelle fonctionnalité ajoutée

### Les dernières dettes restantes

1. **Décommission Node.js** — Encore 4 routes à porter. Ce chantier (P34) est à 90%+ terminé.
2. **Tests frontend** — Seulement 4 fichiers sur 50+ composants. C'est le gap le plus grand.
3. **Drilling props** — AppLayout passe encore 30+ props via props au lieu de context.

### Verdict

Le QA Dashboard est désormais un outil **professionnel et maintenable**. Les fondations architecturales sont solides. Les prochaines étapes sont principalement de la **consolidation** (tests, nettoyage, optimisation) plutôt que de la **réécriture**. Le projet est prêt pour un passage en production à grande échelle avec un effort de 4-6 semaines de consolidation.

---

_Fin du rapport — Basé sur l'état du codebase au 13 mai 2026._
