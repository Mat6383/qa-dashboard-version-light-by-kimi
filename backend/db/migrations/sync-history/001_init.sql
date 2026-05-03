-- Migration 001: Initialisation sync_history
CREATE TABLE IF NOT EXISTS sync_runs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name   TEXT    NOT NULL,
  iteration_name TEXT    NOT NULL,
  mode           TEXT    NOT NULL,
  created        INTEGER NOT NULL DEFAULT 0,
  updated        INTEGER NOT NULL DEFAULT 0,
  skipped        INTEGER NOT NULL DEFAULT 0,
  enriched       INTEGER NOT NULL DEFAULT 0,
  errors         INTEGER NOT NULL DEFAULT 0,
  total_issues   INTEGER NOT NULL DEFAULT 0,
  executed_at    TEXT    NOT NULL
);
