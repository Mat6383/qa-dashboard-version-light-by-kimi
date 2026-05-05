# ⚡ Quick Start

> Voir le [README.md](README.md) complet pour la documentation détaillée.

## Prérequis

- Node.js ≥ 18
- npm ≥ 9
- Python ≥ 3.11 (pour le backend FastAPI)
- uv ≥ 0.5 (gestionnaire de paquets Python, installable via `pip install uv`)

## Installation

```bash
# Node.js (frontend + backend Node legacy)
npm install

# Python (backend actif)
cd backend_py && uv sync
```

## Démarrage

Le backend **Python FastAPI** (port 3001) est le backend actif en production.
Le backend Node.js (port 3001 legacy) est en mode maintenance pour les routes non encore coupées.

```bash
# Backend Python (recommandé — port 3001)
cd backend_py && uv run uvicorn app.main:app --reload --port 3001

# Frontend (port 3000, proxy /api → localhost:3001)
npm run dev -w frontend

# Backend Node.js legacy (si besoin des routes non coupées)
npm run dev -w backend
```

Pour lancer frontend + backend Python en parallèle :

```bash
# Terminal 1
cd backend_py && uv run uvicorn app.main:app --reload --port 3001

# Terminal 2
npm run dev -w frontend
```

## Tests

```bash
# Tests Python (206 tests)
cd backend_py && uv run pytest -q

# Tests Node.js legacy (578 tests)
cd backend && npm test

# Tests frontend
npm test -w frontend
```

## Build production

```bash
# Frontend
npm run build -w frontend

# Backend Python (Docker recommandé)
cd backend_py && docker build -t qa-dashboard-python .
```
