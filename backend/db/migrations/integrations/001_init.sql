CREATE TABLE IF NOT EXISTS integrations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('jira','azure_devops','generic_webhook')),
  config_json   TEXT NOT NULL DEFAULT '{}',
  enabled       INTEGER DEFAULT 1,
  last_sync_at  TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled);
