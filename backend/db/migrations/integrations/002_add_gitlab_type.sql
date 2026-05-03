PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE integrations_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('jira','azure_devops','generic_webhook','gitlab')),
  config_json   TEXT NOT NULL DEFAULT '{}',
  enabled       INTEGER DEFAULT 1,
  last_sync_at  TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

INSERT INTO integrations_new SELECT * FROM integrations;

DROP TABLE integrations;
ALTER TABLE integrations_new RENAME TO integrations;

CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled);

COMMIT;

PRAGMA foreign_keys = ON;
