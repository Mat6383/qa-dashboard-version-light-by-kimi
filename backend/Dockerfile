# syntax=docker/dockerfile:1
# ───────────────────────────────────────────────────────────────────────────────
# Backend — QA Dashboard by Kimi 2.0
# Multi-stage : build TS → runtime Node + Chromium (Puppeteer) + SQLite
# ───────────────────────────────────────────────────────────────────────────────

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1 — Builder : compilation TypeScript + installation de toutes les deps
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Outils de compilation pour better-sqlite3 (bindings natifs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --package-lock=false

COPY . .
RUN npm run build

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2 — Production : runtime léger avec Chromium système
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:22-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV DB_DATA_DIR=/app/db-data

# Dépendances système de Chromium (Puppeteer) + SQLite runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libgbm1 \
    libasound2 \
    libxss1 \
    libgtk-3-0 \
    libsqlite3-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copie des node_modules déjà compilés (bindings natifs inclus) + dist compilé
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Volume pour persistance SQLite (données .db) + logs
# Les services écrivent les bases SQLite dans DB_DATA_DIR (/app/db-data)
# tandis que le code (migrate.js + migrations/) reste dans l'image.
VOLUME ["/app/db-data", "/app/logs"]

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "dist/server.js"]
