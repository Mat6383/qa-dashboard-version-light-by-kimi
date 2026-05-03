# Déploiement — QA Dashboard by Kimi 2.0

> Deux approches de mise en production : **Docker** (recommandé, portabilité maximale) ou **PM2 + Nginx** (manuel sur VPS).

---

## 🐳 Option 1 — Docker (Recommandé)

> Déploiement conteneurisé en 3 commandes. Backend (Node + Chromium), Frontend (Nginx statique), SQLite persistant via volume Docker.

---

### Prérequis

| Outil          | Version | Rôle                         |
| -------------- | ------- | ---------------------------- |
| Docker         | 24.x+   | Container runtime            |
| Docker Compose | 2.20+   | Orchestration multi-services |

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

# Variables d'environnement backend
cp backend/.env.example backend/.env
nano backend/.env
```

**Minimum requis en production :**

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:8080

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
# Build complet (backend + frontend)
docker compose build

# Démarrage en arrière-plan
docker compose up -d

# Vérification
docker compose ps
docker compose logs -f backend
```

**Accès :**

- Application : `http://localhost:8080`
- API directe : `http://localhost:3001/api/health`
- Health checks intégrés sur les deux services.

---

### 3. Mise à jour (zero-downtime)

```bash
# Pull des changements
git pull origin main

# Rebuild + redémarrage
docker compose up -d --build

# Nettoyage des anciennes images (optionnel)
docker image prune -f
```

---

### 4. Backup SQLite

```bash
# Backup du volume
docker run --rm -v dashboard-by-kimi-2-0_sqlite-data:/data \
  -v $(pwd)/backup:/backup alpine \
  tar -czf /backup/dashboard-$(date +%Y%m%d).tar.gz -C /data .

# Ou copie directe depuis le container
docker cp qa-dashboard-backend:/app/db ./backup/db-$(date +%Y%m%d)
```

---

### 5. Commandes utiles

| Action                     | Commande                                    |
| -------------------------- | ------------------------------------------- |
| Logs backend               | `docker compose logs -f backend`            |
| Logs frontend              | `docker compose logs -f frontend`           |
| Restart backend            | `docker compose restart backend`            |
| Shell dans le backend      | `docker compose exec backend bash`          |
| Voir les volumes           | `docker volume ls`                          |
| Arrêter tout               | `docker compose down`                       |
| Arrêter + supprimer volume | `docker compose down -v` ⚠️ (perte données) |

---

### Architecture Docker

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Nginx (80)    │─────▶│  Backend (3001) │─────▶│  SQLite (vol)   │
│  /api → proxy   │      │  Puppeteer PDF  │      │  /app/db/*.db   │
│  / → static SPA │      │  Cron sync      │      │  migrations     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
       frontend               backend                 sqlite-data
```

- **Frontend** : Nginx `alpine-slim` sert `frontend/dist/` et proxifie `/api/` vers le backend.
- **Backend** : Node `bookworm-slim` avec Chromium système (pas de téléchargement Puppeteer). Multi-stage pour minimiser la taille.
- **SQLite** : Volume Docker nommé `sqlite-data` monté sur `/app/db`. Persiste across recréations.

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
# Racine (workspaces backend + frontend)
npm ci

# Build frontend production
cd frontend && npm run build
```

Le build génère le dossier `frontend/dist/` avec les assets optimisés.

---

### 3. Démarrage avec PM2

#### Fichier de configuration PM2

Créer `ecosystem.config.js` à la racine du projet :

```javascript
module.exports = {
  apps: [
    {
      name: 'qa-dashboard-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1, // ou 'max' pour cluster mode (CPU cores)
      exec_mode: 'fork', // 'cluster' si instances > 1
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '512M',
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
pm2 logs qa-dashboard-backend
pm2 monit

# Redémarrage zero-downtime
pm2 reload qa-dashboard-backend

# Arrêt
pm2 stop qa-dashboard-backend
pm2 delete qa-dashboard-backend
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

# Re-install si deps changées
npm ci

# Rebuild frontend
cd frontend && npm run build && cd ..

# Reload PM2 (zero-downtime avec graceful shutdown)
pm2 reload qa-dashboard-backend

# Vérification
pm2 status
curl -s https://dashboard.votre-domaine.fr/api/health | jq .
```

---

### 7. Backup (recommandé)

```bash
# SQLite databases
sudo tar -czf /backup/dashboard-$(date +%Y%m%d).tar.gz \
  /var/www/dashboard-by-kimi-2.0/backend/db/ \
  /var/www/dashboard-by-kimi-2.0/backend/.env
```

---

## Vérification post-déploiement

| Check          | Commande (Docker)                       | Commande (PM2)                                       |
| -------------- | --------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------- |
| Backend up     | `curl http://localhost:3001/api/health` | `curl https://dashboard.votre-domaine.fr/api/health` |
| Frontend build | `curl -I http://localhost:8080` → 200   | `curl -I https://dashboard.votre-domaine.fr` → 200   |
| Containers     | `docker compose ps`                     | —                                                    |
| Logs erreurs   | `docker compose logs backend --tail 50` | `pm2 logs qa-dashboard-backend --lines 50`           |
| SSL valide     | —                                       | `echo                                                | openssl s_client -servername dashboard.votre-domaine.fr -connect dashboard.votre-domaine.fr:443 2>/dev/null | openssl x509 -noout -dates` |
