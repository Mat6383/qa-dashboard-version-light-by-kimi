-- ================================================
-- Migration 005: Webhooks sortants
-- ================================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  url         TEXT NOT NULL,
  events      TEXT NOT NULL,         -- JSON array ["feature-flag.changed", "anomaly.detected"]
  secret      TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT,
  updated_at  TEXT
);
