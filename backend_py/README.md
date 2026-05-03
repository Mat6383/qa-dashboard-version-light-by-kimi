# QA Dashboard — Backend Python (FastAPI)

> **Frontend React conservé tel quel.** Ce backend remplace l'ancien Node/Express/tRPC.

## Démarrage rapide

```bash
cd backend_py
# Installer les dépendances
uv pip install -e ".[dev]"
# ou
pip install -e ".[dev]"

# Copier la config
cp .env.example .env
# Éditer .env avec vos tokens (Testmo, GitLab, JWT_SECRET...)

# Créer les tables
alembic upgrade head

# Lancer
uvicorn app.main:app --reload --port 3001
```

## Docker

```bash
docker-compose -f docker-compose.python.yml up --build
```

## Structure

- `app/main.py` — Point d'entrée FastAPI
- `app/models/` — SQLAlchemy (SQLite)
- `app/routers/` — Endpoints REST + bridge tRPC optionnel
- `app/services/` — Business logic + clients externes
- `app/core/` — Auth, circuit breaker, resilience
- `app/jobs/` — APScheduler (cron)
- `alembic/` — Migrations SQLAlchemy

## Stratégie frontend

Le React en `frontend/` est **conservé inchangé**. Deux options :

1. **Bridge tRPC (rapide)** : le backend expose aussi `/trpc` pour traduire les appels tRPC batch en appels Python internes. Zero changement frontend.
2. **REST pur (propre)** : refactor progressif du frontend pour appeler `/api/*` partout (openapi-typescript peut générer le client TS).

## Points clés de migration depuis Node

| Ancien (Node)        | Nouveau (Python)                        |
| -------------------- | --------------------------------------- |
| Express routes       | FastAPI routers                         |
| tRPC                 | Bridge `/trpc` ou REST pur              |
| better-sqlite3       | aiosqlite + SQLAlchemy 2.0              |
| node-cron            | APScheduler                             |
| Puppeteer            | Playwright Python                       |
| exceljs              | openpyxl                                |
| pptxgenjs            | python-pptx                             |
| nodemailer           | aiosmtplib                              |
| prom-client + Sentry | prometheus-client + sentry-sdk[fastapi] |
| Winston              | logging standard + structlog            |
| Passport GitLab      | OAuth2 manuel + python-jose             |

## Tests

```bash
pytest
```
