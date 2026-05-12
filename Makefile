# ───────────────────────────────────────────────────────────────────────────────
# QA Dashboard by Kimi 2.0 — Makefile
# Commandes rapides pour le développement avec Docker
# ───────────────────────────────────────────────────────────────────────────────

.PHONY: help dev dev-detach prod stop logs logs-prod clean test test-backend lint lint-backend lint-frontend build ps shell-backend shell-frontend

COMPOSE_DEV  := docker compose -f docker-compose.dev.yml
COMPOSE_PROD := docker compose -f docker-compose.yml

help: ## Affiche l'aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Démarre l'environnement de développement (hot-reload)
	$(COMPOSE_DEV) up --build

dev-detach: ## Démarre l'environnement de développement en arrière-plan
	$(COMPOSE_DEV) up --build -d

prod: ## Démarre l'environnement de production
	$(COMPOSE_PROD) up --build -d

stop: ## Arrête tous les environnements
	$(COMPOSE_DEV) down
	$(COMPOSE_PROD) down

logs: ## Affiche les logs de l'environnement de dev
	$(COMPOSE_DEV) logs -f

logs-prod: ## Affiche les logs de l'environnement de production
	$(COMPOSE_PROD) logs -f

clean: ## Nettoie les containers, volumes et images orphelins
	$(COMPOSE_DEV) down -v --remove-orphans
	$(COMPOSE_PROD) down -v --remove-orphans
	docker system prune -f

test-backend: ## Lance les tests du backend (local venv)
	cd backend_py && .venv/bin/pytest -q

test: ## Lance tous les tests (backend + frontend)
	cd backend_py && .venv/bin/pytest -q
	cd frontend && npm run test -- --run

lint-backend: ## Lint & format check du backend Python
	cd backend_py && .venv/bin/ruff check . && .venv/bin/ruff format --check .

lint-frontend: ## Lint du frontend
	cd frontend && npm run lint

lint: lint-backend lint-frontend ## Lint backend + frontend

build: ## Build les images de production
	$(COMPOSE_PROD) build

ps: ## Liste les containers actifs
	@echo "=== DEV ==="
	@$(COMPOSE_DEV) ps
	@echo "=== PROD ==="
	@$(COMPOSE_PROD) ps

shell-backend: ## Ouvre un shell dans le container backend de dev
	$(COMPOSE_DEV) exec backend bash

shell-frontend: ## Ouvre un shell dans le container frontend de dev
	$(COMPOSE_DEV) exec frontend sh
