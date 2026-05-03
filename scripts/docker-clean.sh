#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────────
# Nettoyage complet Docker — QA Dashboard by Kimi 2.0
# Arrête les containers, supprime les images et le volume SQLite
# ⚠️  Attention : le volume SQLite contient les données !
# ───────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="qa-dashboard"

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}⚠️  Cela va arrêter les containers, supprimer les images et le volume SQLite.${NC}"
echo -e "${YELLOW}   Données persistantes dans le volume 'sqlite-data' seront perdues.${NC}"
read -rp "Continuer ? [y/N] " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Annulé."
  exit 0
fi

echo "Arrêt et suppression..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v --rmi all --remove-orphans

echo "Nettoyage des builds orphelins..."
docker system prune -f

echo "✔  Nettoyage terminé."
