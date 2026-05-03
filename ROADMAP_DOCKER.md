# 🐳 Roadmap Docker — QA Dashboard by Kimi 2.0

> Améliorations et évolutions de l'infrastructure Docker.

---

## ✅ Terminé

| #   | Amélioration                                               | Commit    | Date       |
| --- | ---------------------------------------------------------- | --------- | ---------- |
| 1   | Fix `npm ci` → `npm install` (workspace npm sans lockfile) | `689e49f` | 2026-04-28 |
| 2   | Séparation code/données SQLite via `DB_DATA_DIR`           | `689e49f` | 2026-04-28 |
| 3   | Suppression `version: "3.8"` obsolète dans compose         | `689e49f` | 2026-04-28 |
| 4   | Healthcheck déplacé du compose → Dockerfile uniquement     | `689e49f` | 2026-04-28 |
| 5   | Cheatsheet Docker (`DOCKER_CHEATSHEET.md`)                 | `876908f` | 2026-04-28 |

---

## ✅ Terminé (suite session)

| #   | Amélioration                                                                | Fichiers touchés                                  | Commit | Date       |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------- | ------ | ---------- |
| 6   | `.dockerignore` backend + frontend                                          | `backend/.dockerignore`, `frontend/.dockerignore` | —      | 2026-04-28 |
| 7   | `test-docker.sh` avec cache optionnel (`--clean` / `--no-cache`)            | `scripts/test-docker.sh`                          | —      | 2026-04-28 |
| 8   | ~~`depends_on: condition: service_healthy`~~ ❌ Bug Docker Compose — retiré | `docker-compose.yml`                              | —      | 2026-04-28 |

---

## 📋 Backlog (priorisé)

### 🔥 Haute priorité

| #   | Amélioration                                                                                  | Impact                   | Complexité |
| --- | --------------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| 9   | **Corriger les logs Winston** — écrivent dans `/app/dist/logs/` au lieu du volume `/app/logs` | Logs host-inaccessibles  | Faible     |
| 10  | **Limites mémoire/CPU** — ajouter `deploy.resources.limits` dans compose                      | Évite les fuites mémoire | Faible     |
| 11  | **Docker Compose dev** — `docker-compose.dev.yml` avec bind mounts pour hot-reload            | DX (+++)                 | Moyenne    |

### ⚙️ Moyenne priorité

| #   | Amélioration                                                                     | Impact            | Complexité |
| --- | -------------------------------------------------------------------------------- | ----------------- | ---------- |
| 12  | **Multi-architecture** — images ARM64 + AMD64                                    | Déploiement cloud | Moyenne    |
| 13  | **GitHub Action CI/CD** — build + push auto sur Docker Hub / GHCR                | Automatisation    | Moyenne    |
| 14  | **Entrypoint robuste** — script d'init qui vérifie DB/migrations avant démarrage | Robustesse        | Faible     |
| 15  | **Graceful shutdown** — capturer SIGTERM pour fermer SQLite proprement           | Fiabilité         | Faible     |

### 🚀 Basse priorité

| #   | Amélioration                                                                       | Impact                  | Complexité |
| --- | ---------------------------------------------------------------------------------- | ----------------------- | ---------- |
| 16  | **Healthcheck détaillé** — endpoint `/api/health/ready` utilisé par le healthcheck | Meilleure observabilité | Faible     |
| 17  | **nginx.conf dynamique** — générer la conf Nginx selon l'environnement             | Flexibilité             | Moyenne    |
| 18  | **Secrets Docker** — utiliser Docker secrets pour les tokens API                   | Sécurité                | Moyenne    |
| 19  | **Reverse proxy Traefik/Caddy** — remplacer Nginx par un reverse proxy moderne     | Feature                 | Élevée     |

---

## 📝 Décisions architecturales

### Pourquoi `DB_DATA_DIR` ?

Le volume `sqlite-data` montait initialement sur `/app/dist/db`, ce qui masquait `migrate.js` et les migrations SQL compilées. La séparation `/app/db-data` (données) vs `/app/dist/db` (code) résout ce problème proprement.

### Pourquoi healthcheck dans le Dockerfile uniquement ?

Docker Compose a un comportement buggy où un `healthcheck` défini au niveau du service est parfois exécuté **avant** le démarrage du processus principal, causant des échecs immédiats. Le healthcheck du Dockerfile est respecté correctement avec `start_period`.

---

_Dernière mise à jour : 2026-04-28_
