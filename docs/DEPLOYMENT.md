# Déploiement — QA Dashboard by Kimi 2.0

> **Backend actif** : Python 3.11 + FastAPI (`backend_py/`). Le legacy Node.js (`backend/`) est en warm-standby.
> Deux approches : **Docker** (recommandé) ou **PM2 + Nginx** (manuel sur VPS).

---

## 🐳 Option 1 — Docker (Recommandé)

> Déploiement conteneurisé en 3 commandes. Backend (Python + Chromium pour Playwright), Frontend (Nginx statique), SQLite persistant via volume Docker.

---

### Prérequis

| Outil          | Version | Rôle                           |
| -------------- | ------- | ------------------------------ |
| Docker         | 24.x+   | Container runtime              |
| Docker Compose | 2.20+   | Orchestration multi-services   |
| Python         | 3.11+   | Runtime backend (FastAPI)      |
| uv             | 0.5+    | Gestionnaire de paquets Python |

```bash
# Vérification
docker --version
docker compose version
```

---

### 1. Configuration

```bash
# Cloner le repo
git clone https://github.com/Matou6383/dashboard-by-kimi-2.0.git
cd dashboard-by-kimi-2.0

# Variables d'environnement backend Python
cp backend_py/.env.example backend_py/.env
nano backend_py/.env
```

**Minimum requis en production :**

```env
ENVIRONMENT=production
PORT=3001
FRONTEND_URL=http://localhost:8080
DB_DATA_DIR=/app/db-data
BACKUP_DIR=/app/backups

TESTMO_URL=https://votre-instance.testmo.net
TESTMO_TOKEN=your_token_here

GITLAB_URL=https://gitlab.votre-instance.fr
GITLAB_TOKEN=your_read_token
GITLAB_WRITE_TOKEN=your_write_token
GITLAB_VERIFY_SSL=true

ADMIN_API_TOKEN=$(openssl rand -hex 32)

SENTRY_DSN=https://xxx@yyy.sentry.io/zzz   # optionnel mais recommandé
```

> 🔒 Le fichier `.env` est automatiquement exclu du build Docker via `.dockerignore`. Les secrets ne sont jamais dans l'image.

---

### 2. Build & Démarrage

```bash
# Build complet (backend Python + frontend)
docker compose -f docker-compose.python.yml build

# Démarrage en arrière-plan
docker compose -f docker-compose.python.yml up -d

# Vérification
docker compose -f docker-compose.python.yml ps
docker compose -f docker-compose.python.yml logs -f backend
```

**Accès :**

- Application : `http://localhost:8080`
- API directe : `http://localhost:3001/api/health`
- Swagger UI : `http://localhost:3001/api/docs`
- Health checks intégrés sur les deux services.

---

### 3. Mise à jour (zero-downtime)

```bash
# Pull des changements
git pull origin main

# Rebuild + redémarrage
docker compose -f docker-compose.python.yml up -d --build

# Nettoyage des anciennes images (optionnel)
docker image prune -f
```

---

### 4. Backup SQLite

```bash
# Backup du volume
docker run --rm -v qa-dashboard-backend-py-dev_db-data:/data \
  -v $(pwd)/backup:/backup alpine \
  tar -czf /backup/dashboard-$(date +%Y%m%d).tar.gz -C /data .

# Ou copie directe depuis le container
docker cp qa-dashboard-backend-py-dev:/app/db-data ./backup/db-$(date +%Y%m%d)
```

---

### 5. Commandes utiles

| Action                     | Commande                                                                 |
| -------------------------- | ------------------------------------------------------------------------ |
| Logs backend               | `docker compose -f docker-compose.python.yml logs -f backend`            |
| Logs frontend              | `docker compose -f docker-compose.python.yml logs -f frontend`           |
| Restart backend            | `docker compose -f docker-compose.python.yml restart backend`            |
| Shell dans le backend      | `docker compose -f docker-compose.python.yml exec backend bash`          |
| Voir les volumes           | `docker volume ls`                                                       |
| Arrêter tout               | `docker compose -f docker-compose.python.yml down`                       |
| Arrêter + supprimer volume | `docker compose -f docker-compose.python.yml down -v` ⚠️ (perte données) |

---

### Architecture Docker

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Nginx (80)    │─────▶│  Backend (3001) │─────▶│  SQLite (vol)   │
│  /api → proxy   │      │  Playwright PDF │      │  /app/db-data   │
│  / → static SPA │      │  APScheduler    │      │  Alembic mig.   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
       frontend            Python FastAPI            sqlite-data
```

- **Frontend** : Nginx `alpine-slim` sert `frontend/dist/` et proxifie `/api/` vers le backend.
- **Backend** : Python `3.12-slim-bookworm` avec Chromium système (Playwright). Multi-stage build via `uv`.
- **SQLite** : Volume Docker nommé `db-data` monté sur `/app/db-data`. Persiste across recréations.
- **Migrations** : Alembic embarqué, exécutable via `docker compose exec backend alembic upgrade head`.

---

## 🖥️ Option 2 — PM2 + Nginx (VPS manuel)

> Déploiement classique sur serveur Ubuntu/Debian avec PM2 (process manager) et Nginx (reverse proxy).

---

### Prérequis

| Outil   | Version  | Rôle                                       |
| ------- | -------- | ------------------------------------------ |
| Node.js | 22.x LTS | Runtime backend + build frontend           |
| npm     | 10.x     | Gestionnaire de paquets                    |
| PM2     | 5.x      | Process manager (auto-restart, clustering) |
| Nginx   | 1.24+    | Reverse proxy + serveur fichiers statiques |
| Git     | 2.x      | Clonage du repo                            |

### Installation rapide (Ubuntu 24.04)

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
sudo npm install -g pm2

# Nginx
sudo apt-get update
sudo apt-get install -y nginx
```

---

### 1. Cloner et configurer

```bash
cd /var/www
git clone https://github.com/Matou6383/dashboard-by-kimi-2.0.git
cd dashboard-by-kimi-2.0
```

### Variables d'environnement

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

**Minimum requis en production :**

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://dashboard.votre-domaine.fr

TESTMO_URL=https://votre-instance.testmo.net
TESTMO_TOKEN=your_token_here

GITLAB_URL=https://gitlab.votre-instance.fr
GITLAB_TOKEN=your_read_token
GITLAB_WRITE_TOKEN=your_write_token
GITLAB_VERIFY_SSL=true

ADMIN_API_TOKEN=$(openssl rand -hex 32)

SENTRY_DSN=https://xxx@yyy.sentry.io/zzz   # optionnel mais recommandé
```

> 🔒 **Ne jamais** commiter le fichier `.env`. Il est déjà dans `.gitignore`.

---

### 2. Installation des dépendances

```bash
# Backend Python
pip install uv
cd backend_py
uv pip install --system -e ".[dev]"

# Build frontend production
cd ../frontend
npm ci && npm run build
```

---

### 3. Démarrage avec PM2

#### Fichier de configuration PM2

Créer `ecosystem.config.js` à la racine du projet :

```javascript
module.exports = {
  apps: [
    {
      name: 'qa-dashboard-backend-py',
      cwd: './backend_py',
      script: 'python',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 3001',
      instances: 1,
      exec_mode: 'fork',
      env: {
        ENVIRONMENT: 'production',
        PORT: 3001,
      },
      env_production: {
        ENVIRONMENT: 'production',
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      watch: false,
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 10000,
    },
  ],
};
```

#### Commandes PM2

```bash
# Démarrer
pm2 start ecosystem.config.js --env production

# Sauvegarder la config (auto-start au boot)
pm2 save
pm2 startup systemd

# Surveillance
pm2 logs qa-dashboard-backend-py
pm2 monit

# Redémarrage zero-downtime
pm2 reload qa-dashboard-backend-py

# Arrêt
pm2 stop qa-dashboard-backend-py
pm2 delete qa-dashboard-backend-py
```

---

### 4. Configuration Nginx

#### Fichier de site

Créer `/etc/nginx/sites-available/dashboard` :

```nginx
server {
    listen 80;
    server_name dashboard.votre-domaine.fr;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Frontend static files (Vite build)
    location / {
        root /var/www/dashboard-by-kimi-2.0/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts (reports génération peuvent être longs)
        proxy_connect_timeout 30s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Health check endpoint (monitoring externe)
    location /health {
        proxy_pass http://localhost:3001/api/health;
        access_log off;
    }
}
```

#### Activation

```bash
sudo ln -s /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 5. SSL avec Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dashboard.votre-domaine.fr

# Renouvellement auto (déjà configuré par certbot)
sudo certbot renew --dry-run
```

---

### 6. Mise à jour (zero-downtime)

```bash
cd /var/www/dashboard-by-kimi-2.0

# Pull des changements
git pull origin main

# Re-install backend Python si deps changées
cd backend_py && uv pip install --system -e ".[dev]" && cd ..

# Migrations Alembic
cd backend_py && alembic upgrade head && cd ..

# Rebuild frontend
cd frontend && npm ci && npm run build && cd ..

# Reload PM2 (zero-downtime avec graceful shutdown)
pm2 reload qa-dashboard-backend-py

# Vérification
pm2 status
curl -s https://dashboard.votre-domaine.fr/api/health | jq .
```

---

### 7. Backup (recommandé)

```bash
# SQLite databases + env
sudo tar -czf /backup/dashboard-$(date +%Y%m%d).tar.gz \
  /var/www/dashboard-by-kimi-2.0/backend_py/db-data/ \
  /var/www/dashboard-by-kimi-2.0/backend_py/.env
```

---

---

## 8. Migrations Alembic

Les migrations SQL sont gérées par Alembic dans `backend_py/alembic/versions/`.

### Commandes utiles

```bash
# Upgrade vers la dernière version
cd backend_py
alembic upgrade head

# Vérifier la version actuelle
alembic current

# Historique
alembic history --verbose

# Downgrade (⚠️ perte de données si nouvelles tables)
alembic downgrade -1
```

### Révisions existantes

| Révision       | Date    | Description                                                                  |
| -------------- | ------- | ---------------------------------------------------------------------------- |
| `cf4371bc740e` | 2026-04 | Init — tables de base (sync_runs, metric_snapshots, feature_flags, etc.)     |
| `8a0998e7f55f` | 2026-04 | GitLab connector — indexes `ix_integrations_type`, `ix_integrations_enabled` |
| `c64826df80ff` | 2026-05 | Cases sync — `sync_case_runs` + `auto_sync_config` (champ `mode`)            |

### Nouvelles tables (P31)

**`sync_case_runs`** — Historique des synchronisations GitLab → Testmo Cases :

- `id`, `project_id`, `iteration_name`
- `folder_id`, `folder_url` — Dossier Testmo cible
- `stats_created`, `stats_updated`, `stats_skipped`, `stats_errors`
- `details` (JSON) — Logs détaillés par case
- `created_at`

**`auto_sync_config`** — Configuration du job auto-sync :

- `enabled` (bool)
- `mode` (`"cases"` | `"automation"`) — Défaut `"cases"`
- `gitlab_project_id`, `testmo_project_id`, `iteration_name`
- `timezone` (défaut `"Europe/Paris"`)

---

## 9. Vérification post-déploiement

| Check          | Commande (Docker)                       | Commande (PM2)                                                                                                                                      |
| -------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------- |
| -------------- | --------------------------------------- | ----------------------------------------------------                                                                                                | ----------------------------------------------------------------------------------------------------------- | --------------------------- |
| Backend up     | `curl http://localhost:3001/api/health` | `curl https://dashboard.votre-domaine.fr/api/health`                                                                                                |
| Frontend build | `curl -I http://localhost:8080` → 200   | `curl -I https://dashboard.votre-domaine.fr` → 200                                                                                                  |
| Containers     | `docker compose ps`                     | —                                                                                                                                                   |
| Logs erreurs   | `docker compose logs backend --tail 50` | `pm2 logs qa-dashboard-backend --lines 50`                                                                                                          |
| SSL valide     | —                                       | `echo \| openssl s_client -servername dashboard.votre-domaine.fr -connect dashboard.votre-domaine.fr:443 2>/dev/null \| openssl x509 -noout -dates` |
