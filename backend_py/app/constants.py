"""Shared constants across backend services."""

from __future__ import annotations

# ── Pagination guardrails ───────────────────────────────────────────────────
MAX_PAGES = 100

# ── Default business-logic keywords (overridable via Settings) ──────────────
DEFAULT_PROD_RUN_KEYWORDS = ["patch", "retour de prod", "retour", "prod"]
DEFAULT_PREPROD_RUN_KEYWORDS = ["tnr"]
