# 🐳 Docker Cheatsheet — QA Dashboard by Kimi 2.0

> Commandes essentielles pour gérer l'application en local avec Docker.

---

## 🚀 Démarrage rapide (prod-like)

```bash
cd "/Users/matou/Kimi code - Workspace/QA-dashboard by kimi 2.0"
docker compose -f docker-compose.yml up -d
```

- Frontend → http://localhost:8080
- Backend API → http://localhost:3001
- Healthcheck → http://localhost:3001/api/health

Vérifier que tout est vert :

```bash
docker ps
curl -fsS http://localhost:8080/ && echo "✅ Frontend OK"
curl -fsS http://localhost:8080/api/health && echo "✅ Proxy API OK"
```

---

## 🧪 Test complet (build + smoke tests)

```bash
./scripts/test-docker.sh
```

Fait un build from scratch (`--no-cache`), démarre les services, vérifie le healthcheck et lance 3 smoke tests.

> ⚠️ Ce script nettoie les containers à la fin (mais **pas** les volumes).

---

## 🛑 Arrêter les services

```bash
# Arrêter sans supprimer le volume de données
docker compose -f docker-compose.yml down

# Arrêter ET supprimer le volume SQLite (données perdues !)
docker compose -f docker-compose.yml down -v
```

---

## 🧹 Nettoyage complet (nucléaire)

```bash
# Script officiel — supprime containers, images et volumes
./scripts/docker-clean.sh

# Ou manuellement :
docker compose -f docker-compose.yml down -v --remove-orphans
docker system prune -f
```

---

## 🔄 Rebuild des images

```bash
# Rebuild uniquement si le code a changé
docker compose -f docker-compose.yml build

# Rebuild from scratch (ignore le cache)
docker compose -f docker-compose.yml build --no-cache

# Rebuild + démarrage en une commande
docker compose -f docker-compose.yml up -d --build
```

---

## 📋 Logs et debug

```bash
# Logs backend en temps réel
docker compose -f docker-compose.yml logs -f backend

# Logs frontend en temps réel
docker compose -f docker-compose.yml logs -f frontend

# Dernières lignes backend
docker compose -f docker-compose.yml logs backend --tail 50

# Statut healthcheck
docker inspect --format='{{.State.Health.Status}}' qa-dashboard-backend
```

---

## 🔍 Diagnostic interactif

```bash
# Lancer le backend en interactif (pour voir les erreurs brutes)
docker run --rm -it --env-file backend/.env qa-dashboard-backend:latest node dist/server.js

# Shell dans le container backend
docker exec -it qa-dashboard-backend sh

# Vérifier les fichiers dans l'image
docker run --rm qa-dashboard-backend:latest ls -la /app/dist/db
```

---

## 🗂️ Volumes et persistance

```bash
# Lister les volumes
docker volume ls | grep qa-dashboard

# Inspecter un volume
docker volume inspect qa-dashboard_sqlite-data

# Supprimer un volume manuellement
docker volume rm qa-dashboard_sqlite-data
```

Le volume `sqlite-data` contient les bases SQLite (`.db`). Il est monté sur `/app/db-data` dans le container.

---

## ⚠️ Troubleshooting

### `Conflict. The container name ... is already in use`

```bash
docker rm -f qa-dashboard-backend qa-dashboard-frontend
docker compose -f docker-compose.yml up -d
```

### `Backend unhealthy` au démarrage

1. Vérifier que `backend/.env` a les 4 variables requises :
   ```bash
   grep -E '^(TESTMO_URL|TESTMO_TOKEN|GITLAB_URL|GITLAB_TOKEN)=' backend/.env
   ```
2. Nettoyer le volume pollué et relancer :
   ```bash
   docker compose -f docker-compose.yml down -v
   ./scripts/test-docker.sh
   ```

### `Cannot find module '../db/migrate'`

Le volume masque le code compilé. Solution : nettoyer le volume.

```bash
docker compose -f docker-compose.yml down -v
docker volume rm qa-dashboard_sqlite-data 2>/dev/null || true
./scripts/test-docker.sh
```

### Port déjà utilisé (`3001` ou `8080`)

```bash
# Trouver le processus sur le port
lsof -i :3001
lsof -i :8080

# Ou changer les ports dans docker-compose.yml
```

---

## 📝 Notes

- Le `test-docker.sh` utilise `-p qa-dashboard` comme nom de projet.
- `docker compose up` sans `-p` utilise le nom du dossier (`qa-dashboardbykimi20`).
- Pour éviter les conflits, préférez `docker compose -f docker-compose.yml down` avant de changer de mode (script vs manuel).
