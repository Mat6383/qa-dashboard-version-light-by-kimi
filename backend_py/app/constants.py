"""Shared constants across backend services."""

from __future__ import annotations

# ── Pagination guardrails ───────────────────────────────────────────────────
MAX_PAGES = 100


class PaginatedList(list):
    """A list that carries a ``truncated`` flag when pagination was capped."""

    truncated: bool = False


# ── Default business-logic keywords (overridable via Settings) ──────────────
DEFAULT_PROD_RUN_KEYWORDS = ["patch", "retour de prod", "retour", "prod"]
DEFAULT_PREPROD_RUN_KEYWORDS = ["tnr"]
