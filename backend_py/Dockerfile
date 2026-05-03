# ── Production Dockerfile ───────────────────────────────
FROM python:3.12-slim-bookworm AS builder

WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml .
RUN uv pip install --system --no-cache -e .

# Runtime stage with Chromium for Playwright
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    rsync \
    openssh-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DB_DATA_DIR=/app/db-data \
    BACKUP_DIR=/app/backups

WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY data/ ./data/

RUN mkdir -p /app/db-data /app/backups /app/logs

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/api/health/ || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
