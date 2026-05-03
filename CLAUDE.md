# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QA Dashboard — a monitoring tool for Testmo test results. It integrates Testmo (test management) with GitLab (issue tracking) and provides a React-based dashboard with ISTQB metrics (Completion Rate, Pass Rate, Failure Rate, Test Efficiency).

## Architecture

Two independent processes, run in separate terminals:

- **Backend** (`backend/`): Express/Node.js API server on port 3001. Proxies requests to Testmo API, computes metrics, manages GitLab sync. Requires `backend/.env`.
- **Frontend** (`frontend/`): React + Vite SPA on port 3000. Talks only to the backend — never directly to Testmo or GitLab.

### Backend structure

- `server.js` — Entry point. Mounts all routers, initializes SQLite-backed services, registers the auto-sync cron job.
- `routes/` — One router per domain: `dashboard`, `projects`, `runs`, `sync`, `reports`, `crosstest`, `cache`, `health`.
- `services/` — Business logic:
  - `testmo.service.js` — Testmo API calls + ISTQB metric computation. Exports standalone helpers (`_calculatePercentage`, `aggregateSessions`, `globalMetrics`) for unit testing.
  - `sync.service.js` — GitLab → Testmo sync (creates test cases from issues). Exports `extractStepsFromNotes` for unit testing.
  - `status-sync.service.js` — Testmo → GitLab sync (maps test result statuses to GitLab labels). Exports `STATUS_TO_LABEL`, `buildCommentText`, `computeLabelChanges`, etc.
  - `gitlab.service.js` — GitLab API client.
  - `auto-sync-config.service.js` — Persists auto-sync cron config to `backend/data/auto-sync-config.json`. Modifiable at runtime via `PUT /api/sync/auto-config`.
  - `syncHistory.service.js` — SQLite-based sync run history.
  - `comments.service.js` — Manages GitLab comment deduplication.
  - `logger.service.js` — Winston logger.
- `validators/index.js` — Zod schemas + Express middleware factories (`validateParams`, `validateBody`, `validateQuery`).
- `config/projects.config.js` — Static multi-project mapping (Testmo IDs ↔ GitLab project IDs). Only `neo-pilot` is `configured: true`.

### Frontend structure

- `src/App.jsx` — Root component. Manages global state (project selection, dashboard view, dark mode, TV mode). User preferences persisted to `localStorage` under `testmo_*` keys.
- `src/components/Dashboard*.jsx` — Numbered dashboard views (3–8) selectable from the header. Dashboard8 = Auto-Sync control panel.
- `src/services/api.service.js` — All HTTP calls to the backend.

### Auto-sync cron

Runs every 5 minutes Mon–Fri 8h–18h (Europe/Paris). Controlled by `auto-sync-config.service.js`. The cron is always registered; the `enabled` flag in the config gates execution. Config is updated at runtime via `PUT /api/sync/auto-config`.

### Testmo status ID mapping (non-standard)

This instance uses empirically verified IDs (different from Testmo defaults):

| status_id | Meaning | GitLab label |
|-----------|---------|--------------|
| 2 | Passed | `Test::OK` |
| 3 | Failed | `Test::KO` |
| 4 | Retest | `DoubleTestNécessaire` |
| 8 | WIP | `Test::WIP` |

## Commands

### Backend

```bash
cd backend
npm install          # Install dependencies
npm start            # Production start (node server.js)
npm run dev          # Dev with nodemon (auto-reload)
npm test             # Run Jest tests
```

### Frontend

```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Vite dev server → http://localhost:3000
npm run build        # Production build → dist/
npm run preview      # Preview production build
```

### Run a single test

```bash
cd backend
npx jest tests/calculations.test.js
# Or by test name:
npx jest -t "_calculatePercentage"
```

### Required environment variables (`backend/.env`)

```
TESTMO_URL=https://your-instance.testmo.net
TESTMO_TOKEN=your_api_token
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
GITLAB_TOKEN=your_gitlab_token
GITLAB_WRITE_TOKEN=your_gitlab_write_token   # optional, for label writes
GITLAB_URL=https://your-gitlab.com
# Auto-sync defaults (overridable at runtime via API):
SYNC_AUTO_ENABLED=false
SYNC_AUTO_RUN_ID=
SYNC_AUTO_ITERATION_NAME=
SYNC_AUTO_GITLAB_PROJECT_ID=
```

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/projects` | List Testmo projects |
| GET | `/api/dashboard/:projectId` | Full ISTQB metrics for a project |
| POST | `/api/sync/preview` | Dry-run GitLab → Testmo sync |
| POST | `/api/sync/execute` | Execute sync (SSE streaming) |
| POST | `/api/sync/status-to-gitlab` | Sync Testmo results → GitLab labels (SSE) |
| GET | `/api/sync/auto-config` | Get auto-sync cron config |
| PUT | `/api/sync/auto-config` | Update auto-sync config at runtime |
| GET | `/api/sync/history` | Last 50 sync runs (SQLite) |

## SLA Thresholds (ITIL)

Defined in `backend/services/testmo.service.js`:

```js
const SLA_THRESHOLDS = {
  passRate: { target: 95, warning: 90, critical: 85 },
  blockedRate: { max: 5 },
  completionRate: { target: 90, warning: 80 }
};
```
