# Architecture Python — QA Dashboard Backend (React conservé)

> **Scope** : migration du backend Node/Express/tRPC → FastAPI + SQLAlchemy.  
> **Le frontend React reste inchangé** ; seule l'URL d'API éventuellement change.

---

## 1. Vision & Décisions

| Question         | Décision                                    | Justification                                                     |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| **Backend**      | FastAPI + SQLAlchemy 2.0 + Alembic          | Async natif, validation Pydantic, OpenAPI auto, écosystème mature |
| **DB**           | SQLite (mêmes fichiers `.db`)               | Migration zero-downtime des données ; WAL mode conservé           |
| **Frontend**     | **React 18 conservé tel quel**              | Seuls les appels API évoluent (tRPC → REST ou bridge)             |
| **Auth**         | OAuth2 GitLab + JWT (`python-jose`)         | Équivalent fonctionnel au Passport.js actuel                      |
| **Jobs**         | APScheduler (async)                         | Remplace `node-cron`, intégré à FastAPI lifespan                  |
| **PDF**          | Playwright (`playwright-python`)            | Remplace Puppeteer, même moteur Chromium                          |
| **Excel/CSV**    | `openpyxl` + `csv` stdlib                   | Remplace ExcelJS                                                  |
| **PPTX**         | `python-pptx`                               | Remplace `pptxgenjs`                                              |
| **Email**        | `aiosmtplib`                                | Remplace Nodemailer                                               |
| **Monitoring**   | `prometheus-client` + `sentry-sdk[fastapi]` | Équivalent fonctionnel                                            |
| **WebSocket**    | FastAPI native `WebSocket`                  | Remplace `ws` library                                             |
| **SSE**          | FastAPI `StreamingResponse`                 | Native                                                            |
| **HTTP externe** | `httpx` (async) + `tenacity`                | Remplace Axios + circuit breaker maison                           |
| **Migrations**   | Alembic + runner SQL legacy                 | Rejoue les `.sql` existants puis Alembic pour la suite            |

---

## 2. Structure du projet

```
backend_py/
├── pyproject.toml              # uv/poetry deps
├── Dockerfile / Dockerfile.dev
├── docker-compose.python.yml
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Point d'entrée FastAPI + lifespan
│   ├── config.py               # Pydantic Settings (env vars)
│   ├── database.py             # SQLAlchemy engine/session (2 DBs SQLite)
│   ├── deps.py                 # Dépendances FastAPI (DB, auth, admin)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py             # DeclarativeBase + mixins timestamp
│   │   ├── sync_history.py     # sync_runs, metric_snapshots, project_groups
│   │   ├── feature_flags.py    # feature_flags
│   │   ├── notifications.py    # notification_settings, alert_log
│   │   ├── webhooks.py         # webhook_subscriptions
│   │   ├── audit.py            # audit_log
│   │   ├── analytics.py        # analytics_insights
│   │   ├── retention.py        # retention_policies, archived_snapshots
│   │   ├── integrations.py     # integrations
│   │   ├── users.py            # users
│   │   └── comments.py         # crosstest_comments
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── health.py
│   │   ├── auth.py
│   │   ├── projects.py
│   │   ├── dashboard.py
│   │   ├── runs.py
│   │   ├── sync.py
│   │   ├── crosstest.py
│   │   ├── export.py
│   │   ├── pdf.py
│   │   ├── reports.py
│   │   ├── notifications.py
│   │   ├── feature_flags.py
│   │   ├── webhooks.py
│   │   ├── audit.py
│   │   ├── anomalies.py
│   │   ├── cache.py
│   │   ├── backups.py
│   │   ├── metrics.py          # Prometheus scrape
│   │   └── trpc_bridge.py      # Optionnel : adapteur tRPC → Python
│   ├── services/
│   │   ├── __init__.py
│   │   ├── testmo.py           # Client Testmo + cache + circuit breaker
│   │   ├── gitlab.py           # Client GitLab REST/GraphQL + circuit breaker
│   │   ├── gitlab_connector.py
│   │   ├── sync.py             # Sync GitLab → Testmo
│   │   ├── status_sync.py      # Sync Testmo → GitLab
│   │   ├── report.py           # Orchestration rapports
│   │   ├── report/
│   │   │   ├── collect_data.py
│   │   │   ├── generate_html.py
│   │   │   └── generate_pptx.py
│   │   ├── export.py           # CSV / Excel
│   │   ├── pdf.py              # Playwright page pool
│   │   ├── analytics.py
│   │   ├── anomaly.py
│   │   ├── email.py
│   │   ├── alert.py
│   │   ├── template.py
│   │   ├── backup.py           # VACUUM INTO + gzip + S3/rsync
│   │   ├── webhook_emitter.py
│   │   └── auto_sync_config.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py         # JWT sign/verify, pwd hash
│   │   ├── circuit_breaker.py  # Port du CircuitBreaker TS
│   │   └── resilience.py       # tenacity wrapper
│   ├── jobs/
│   │   ├── __init__.py
│   │   ├── scheduler.py        # APScheduler init + lifespan bridge
│   │   ├── auto_sync.py
│   │   ├── metrics_snapshot.py
│   │   ├── audit_prune.py
│   │   ├── backup.py
│   │   ├── analytics.py
│   │   └── retention.py
│   └── utils/
│       ├── __init__.py
│       ├── logger.py           # structlog / standard logging redact
│       └── migrations.py       # Runner SQL legacy (compat .sql actuels)
├── data/                       # auto-sync-config.json, etc.
├── logs/
└── tests/
```

---

## 3. Modèles SQLAlchemy (mapping des tables SQLite)

Tous les modèles héritent de `Base` et utilisent `Mapped[]` + `mapped_column` (SQLA 2.0 style).
Les types JSON sont stockés en `JSON` (SQLite les sérialise en TEXT natif).

### Base de données multiples

L'application actuelle utilise 2 fichiers `.db`. En SQLAlchemy on configure 2 `Engine` :

- `engine_main` → `sync-history.db` (toutes les tables opérationnelles)
- `engine_comments` → `crosstest-comments.db`

On utilise un `sessionmaker` par engine et une factory de dépendance FastAPI qui route vers le bon engine selon le contexte (ou on merge en une seule DB via Alembic lors de la migration).

**Recommandation migration** : lors du premier déploiement Python, faire migrer Alembic qui crée toutes les tables dans un seul fichier SQLite (plus simple), avec un script de reprise des données depuis les 2 fichiers legacy.

---

## 4. API FastAPI — Stratégie pour conserver le React

Le frontend actuel utilise **deux protocoles** : REST (Axios) et tRPC (React Query).

### Option A : Bridge tRPC (recommandé pour un cutover rapide)

On conserve le endpoint `/trpc` mais il est désormais servi par FastAPI. Le bridge :

1. Reçoit les requêtes tRPC batch JSON
2. Désérialise le batch
3. Route chaque procédure vers la fonction Python interne correspondante
4. Re-sérialise au format tRPC (SuperJSON-compatible)

Avantages :

- **Zero modification du frontend**
- Cutover en 1 jour une fois le backend prêt
- On peut migrer progressivement les appels tRPC vers du REST pur plus tard

Inconvénients :

- Pas de vérification de types côté serveur (on perd l'intérêt de tRPC)
- Couche technique à maintenir temporairement

### Option B : Migration progressive REST

On expose **toutes les routes en REST** sous `/api/*`. Le frontend est refactoré pour :

- Remplacer les appels tRPC par des appels `fetch` / Axios vers `/api/*`
- Conserver la même structure de réponse (JSON shapes identiques)

Avantages :

- Plus propre, pas de hack
- OpenAPI/Swagger généré automatiquement par FastAPI
- Frontend simplifié (un seul client HTTP)

Inconvénients :

- 3-4 jours de refactor frontend
- Perte du typage end-to-end tRPC (mais on peut générer un client TypeScript via `openapi-typescript`)

### Verdict architectural

| Phase               | Action                                                |
| ------------------- | ----------------------------------------------------- |
| **Phase 1**         | Implémenter le **bridge tRPC** pour un cutover rapide |
| **Phase 2** (futur) | Migrer les appels tRPC vers REST au fil de l'eau      |

---

## 5. Auth & Sécurité

### OAuth2 GitLab

1. `GET /api/auth/gitlab` → redirige vers `https://gitlab.com/oauth/authorize`
2. `GET /api/auth/gitlab/callback` → échange le code, récupère le user GitLab, upsert en DB, crée JWT access + refresh
3. Redirection frontend : `/auth/callback?token=<jwt_access>`
4. Le frontend stocke le token en `localStorage` et l'envoie dans `Authorization: Bearer`

### JWT

- **Access token** : 15 min, payload `{sub, email, role}`
- **Refresh token** : 7 jours, `httpOnly` cookie sécurisé
- Refresh via `POST /api/auth/refresh`

### Dépendances FastAPI

```python
async def require_auth(token: str = Header(...)) -> User:
    ...

async def require_admin(user: User = Depends(require_auth)) -> User:
    if user.role != "admin":
        raise HTTPException(403, ...)
    ...

async def require_admin_token(x_admin_token: str = Header(...)):
    if not secrets.compare_digest(x_admin_token, settings.admin_api_token):
        raise HTTPException(403, ...)
```

### Middleware sécurité

- `CORSMiddleware` (origins depuis `FRONTEND_URL`)
- `TrustedHostMiddleware`
- Rate limiting : `slowapi` (Limiter basé sur Redis ou mémoire)
  - Global : 200/min
  - Heavy : 20/min sur `/reports`, `/pdf`, `/export`, `/sync/execute`
- `GZipMiddleware`

---

## 6. Services métier clés

### 6.1 Testmo Service (`services/testmo.py`)

- Client `httpx.AsyncClient` avec timeout configurable
- Cache in-memory : `cachetools.TTLCache` (remplace le `Map` TS)
- Circuit breaker : custom porté depuis `utils/circuitBreaker.ts`
- Méthodes clés : `get_projects`, `get_project_metrics` (agrégation ISTQB), `get_escape_and_detection_rates`, etc.

### 6.2 GitLab Service (`services/gitlab.py`)

- `httpx.AsyncClient` pour REST
- `httpx.AsyncClient` pour GraphQL (endpoint `/api/graphql`)
- 2 tokens : read (`GITLAB_TOKEN`) et write (`GITLAB_WRITE_TOKEN`)

### 6.3 PDF Service (`services/pdf.py`)

- Playwright async (`async_playwright`)
- Page pool maison : asyncio queue + semaphore
- Même logique de rotation, idle timeout, max generations

### 6.4 Backup Service (`services/backup.py`)

- `VACUUM INTO` via `aiosqlite` ou thread pool
- Compression `gzip` via `asyncio.to_thread`
- Upload S3 : `aiobotocore` ou `boto3` en thread pool
- rsync : `asyncio.create_subprocess_exec`

### 6.5 Resilience (`core/resilience.py` + `core/circuit_breaker.py`)

- `tenacity` : retry exponential backoff sur 5xx, 429, network
- `CircuitBreaker` : port exact de la classe TS (états CLOSED/OPEN/HALF_OPEN, failure threshold, recovery timeout)

---

## 7. Jobs planifiés (APScheduler)

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
scheduler.add_job(auto_sync_job, "cron", minute="*/5", hour="8-17", day_of_week="mon-fri")
scheduler.add_job(metrics_snapshot_job, "cron", hour=2)
scheduler.add_job(audit_prune_job, "interval", hours=24)
scheduler.add_job(backup_job, "cron", hour=3)
scheduler.add_job(analytics_job, "cron", hour=3)
scheduler.add_job(retention_job, "cron", hour=4, day_of_week="sun")
```

Démarrage dans le `lifespan` de FastAPI :

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()
```

---

## 8. WebSockets & SSE

### SSE (remplace `/dashboard/:id/stream`)

```python
from fastapi import Request
from fastapi.responses import StreamingResponse
import asyncio

async def dashboard_event_generator(project_id: int, request: Request):
    while True:
        if await request.is_disconnected():
            break
        data = await compute_dashboard(project_id)
        yield f"data: {data.model_dump_json()}\n\n"
        await asyncio.sleep(5)

@router.get("/{project_id}/stream")
async def stream(project_id: int, request: Request):
    return StreamingResponse(
        dashboard_event_generator(project_id, request),
        media_type="text/event-stream"
    )
```

### WebSocket (remplace `/ws/dashboard`)

```python
@router.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    await websocket.accept()
    room = get_or_create_room(websocket.query_params)
    room.add(websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            if json.loads(msg).get("type") == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        room.remove(websocket)
```

---

## 9. Docker & Déploiement

### Production

```dockerfile
FROM python:3.12-slim-bookworm AS builder

WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml .
RUN uv pip install --system --no-cache -e .

# Runtime stage with Chromium for Playwright
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    rsync \
    openssh-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DB_DATA_DIR=/app/db-data \
    BACKUP_DIR=/app/backups

WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY data/ ./data/

RUN mkdir -p /app/db-data /app/backups /app/logs

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/api/health/ || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
```

### Dev (hot-reload)

```dockerfile
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    rsync \
    openssh-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml .
RUN uv pip install --system --no-cache -e ".[dev]"

EXPOSE 3001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001", "--reload"]
```

### docker-compose.python.yml

```yaml
services:
  backend:
    build:
      context: ./backend_py
      dockerfile: Dockerfile.dev
    container_name: qa-dashboard-backend-py-dev
    ports:
      - '3001:3001'
    env_file:
      - ./backend_py/.env
    environment:
      - ENVIRONMENT=development
      - FRONTEND_URL=http://localhost:3000
    volumes:
      - ./backend_py:/app
      - ./backend_py/db-data:/app/db-data
      - ./backend_py/backups:/app/backups
      - ./backend_py/logs:/app/logs
    networks:
      - dashboard-net

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: qa-dashboard-frontend-dev
    ports:
      - '3000:3000'
    environment:
      - BACKEND_URL=http://backend:3001
      - CHOKIDAR_USEPOLLING=true
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    networks:
      - dashboard-net

networks:
  dashboard-net:
    driver: bridge
```

---

## 10. Plan de migration par étapes

### Phase 1 : Squelette & DB (2-3 jours)

- [ ] Générer les modèles SQLAlchemy
- [ ] Configurer Alembic + runner des migrations `.sql` legacy
- [ ] Dockerfile Python + docker-compose dev
- [ ] Health endpoint + métriques Prometheus

### Phase 2 : Auth & core services (2-3 jours)

- [ ] OAuth2 GitLab + JWT
- [ ] Testmo service (client + cache + CB)
- [ ] GitLab service
- [ ] Middleware sécurité + rate limiting

### Phase 3 : API REST complète (4-5 jours)

- [ ] Tous les routers REST (/projects, /dashboard, /runs, /sync, /crosstest, etc.)
- [ ] SSE & WebSocket
- [ ] Export CSV/Excel/PDF/Reports

### Phase 4 : tRPC bridge (2-3 jours)

- [ ] Implémenter `/trpc` qui reçoit les batchs tRPC
- [ ] Mapper chaque router tRPC vers les fonctions Python
- [ ] Sérialisation SuperJSON-compatible
- [ ] **Aucune modification du frontend React**

### Phase 5 : Jobs & infra (2 jours)

- [ ] APScheduler + tous les jobs
- [ ] Backup service (S3 + rsync)
- [ ] Sentry + logging structuré

### Phase 6 : Tests & validation (2-3 jours)

- [ ] Tests pytest (parallèles aux tests Jest)
- [ ] E2E Playwright (inchangés, juste changer `BASE_URL`)
- [ ] Migration des données SQLite legacy → nouveau schéma

### Phase 7 : Cutover

- [ ] Stop backend Node
- [ ] `alembic upgrade head` + import données
- [ ] Start backend Python
- [ ] Smoke tests E2E

---

## 11. Checklist "React inchangé"

| Élément frontend       | Impact migration                                  |
| ---------------------- | ------------------------------------------------- |
| `VITE_API_URL=/api`    | Aucun changement (FastAPI sert aussi sous `/api`) |
| `VITE_WS_URL=ws://...` | Aucun changement (FastAPI WebSocket natif)        |
| Appels Axios `/api/*`  | Aucun changement (mêmes endpoints REST)           |
| Appels tRPC `/trpc/*`  | **Nécessite le bridge** (Phase 4)                 |
| `localStorage` token   | Aucun changement (même format JWT)                |
| Pages admin            | Aucun changement (même guards, mêmes roles)       |
| Builds Vite            | Aucun changement                                  |
