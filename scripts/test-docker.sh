#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────────
# Script de test local Docker — QA Dashboard by Kimi 2.0
# Build, démarrage, health-checks et smoke tests
# ───────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_NAME="qa-dashboard"
COMPOSE_FILE="docker-compose.yml"
NO_CACHE=""

# Parse arguments
for arg in "$@"; do
  if [[ "$arg" == "--clean" || "$arg" == "--no-cache" ]]; then
    NO_CACHE="--no-cache"
  fi
done

# ─── Helpers ──────────────────────────────────────────────────────────────────
function info()  { echo -e "${BLUE}ℹ${NC}  $1"; }
function ok()    { echo -e "${GREEN}✔${NC}  $1"; }
function warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
function error() { echo -e "${RED}✘${NC}  $1"; }

function cleanup() {
  echo
  warn "Nettoyage des containers de test..."
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down --remove-orphans 2>/dev/null || true
}

# ─── Prérequis ────────────────────────────────────────────────────────────────
info "Vérification des prérequis..."

if ! command -v docker &>/dev/null; then
  error "Docker n'est pas installé ou n'est pas dans le PATH."
  exit 1
fi

if ! docker compose version &>/dev/null; then
  error "Docker Compose plugin n'est pas installé."
  exit 1
fi

if [[ ! -f "backend/.env" ]]; then
  error "backend/.env manquant. Copiez backend/.env.example et renseignez les variables."
  exit 1
fi

ok "Prérequis OK"

# ─── Build ────────────────────────────────────────────────────────────────────
if [[ -n "$NO_CACHE" ]]; then
  info "Build des images Docker (sans cache)..."
else
  info "Build des images Docker (avec cache)..."
fi
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build $NO_CACHE
ok "Build terminé"

# ─── Démarrage ────────────────────────────────────────────────────────────────
info "Démarrage des services..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d

# Attente que le backend soit healthy (max 90s)
info "Attente du healthcheck backend (max 90s)..."
for i in {1..30}; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "${PROJECT_NAME}-backend" 2>/dev/null || echo "starting")
  if [[ "$STATUS" == "healthy" ]]; then
    ok "Backend healthy"
    break
  elif [[ "$STATUS" == "unhealthy" ]]; then
    error "Backend unhealthy"
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs backend --tail 50
    cleanup
    exit 1
  fi
  sleep 3
done

BACKEND_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "${PROJECT_NAME}-backend" 2>/dev/null || echo "unknown")
if [[ "$BACKEND_STATUS" != "healthy" ]]; then
  error "Timeout en attendant le backend"
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs backend --tail 50
  cleanup
  exit 1
fi

# ─── Smoke tests ──────────────────────────────────────────────────────────────
echo
info "Smoke tests..."

# Test 1 : Health API
if curl -fsS http://localhost:3001/api/health >/dev/null 2>&1; then
  ok "GET /api/health → 200"
else
  error "GET /api/health → échec"
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs backend --tail 30
  cleanup
  exit 1
fi

# Test 2 : Frontend Nginx
if curl -fsS http://localhost:8080/ >/dev/null 2>&1; then
  ok "GET / → 200 (frontend Nginx)"
else
  error "GET / → échec"
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs frontend --tail 30
  cleanup
  exit 1
fi

# Test 3 : Proxy /api/ via Nginx
if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
  ok "GET /api/health via Nginx proxy → 200"
else
  error "GET /api/health via Nginx proxy → échec"
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs frontend --tail 20
  cleanup
  exit 1
fi

# ─── Résumé ───────────────────────────────────────────────────────────────────
echo
ok "🎉  Tous les tests ont réussi !"
echo
echo -e "${BLUE}Services actifs :${NC}"
echo "  • Frontend → http://localhost:8080"
echo "  • Backend  → http://localhost:3001"
echo
echo -e "${YELLOW}Commandes utiles :${NC}"
echo "  docker compose -f $COMPOSE_FILE logs -f backend"
echo "  docker compose -f $COMPOSE_FILE logs -f frontend"
echo "  docker compose -f $COMPOSE_FILE down"
echo
echo -e "${YELLOW}Pour nettoyer complètement (images + volumes) :${NC}"
echo "  ./scripts/docker-clean.sh"
