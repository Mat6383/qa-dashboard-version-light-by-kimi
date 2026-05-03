-- Migration 002: Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  updated_at  TEXT
);

-- Flags par défaut
INSERT OR IGNORE INTO feature_flags (key, enabled, description, updated_at)
VALUES
  ('annualTrendsV2', 0, 'Nouveau dashboard Annual Trends (expérimental)', datetime('now')),
  ('crosstestBulkEdit', 0, 'Édition en masse des commentaires CrossTest', datetime('now'));
