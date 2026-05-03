# syntax=docker/dockerfile:1
# ───────────────────────────────────────────────────────────────────────────────
# Frontend — QA Dashboard by Kimi 2.0
# Multi-stage : build Vite → serveur Nginx statique
# ───────────────────────────────────────────────────────────────────────────────

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1 — Builder : build de production Vite
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --package-lock=false

COPY . .

# L'API est servie derrière le même reverse-proxy (Nginx) en production,
# donc les appels frontend vers "/api" sont proxifiés vers le backend.
ENV VITE_API_URL=/api
RUN npm run build

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2 — Production : Nginx minimal pour servir les assets statiques
# ═══════════════════════════════════════════════════════════════════════════════
FROM nginx:alpine-slim

# Configuration Nginx (reverse-proxy /api vers le backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Assets statiques générés par Vite
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
