CREATE TABLE IF NOT EXISTS retention_policies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type     TEXT NOT NULL UNIQUE CHECK(entity_type IN ('sync_history','metric_snapshots','audit_logs','analytics_insights')),
  retention_days  INTEGER NOT NULL DEFAULT 365,
  auto_archive    INTEGER DEFAULT 1,
  auto_delete     INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS archived_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  project_id    INTEGER,
  data_json     TEXT NOT NULL,
  archived_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_archived_type ON archived_snapshots(entity_type);
CREATE INDEX IF NOT EXISTS idx_archived_project ON archived_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_archived_at ON archived_snapshots(archived_at);

-- Valeurs par défaut
INSERT OR IGNORE INTO retention_policies (entity_type, retention_days, auto_archive, auto_delete)
VALUES ('sync_history', 90, 1, 0);
INSERT OR IGNORE INTO retention_policies (entity_type, retention_days, auto_archive, auto_delete)
VALUES ('metric_snapshots', 730, 1, 0);
INSERT OR IGNORE INTO retention_policies (entity_type, retention_days, auto_archive, auto_delete)
VALUES ('audit_logs', 365, 1, 0);
INSERT OR IGNORE INTO retention_policies (entity_type, retention_days, auto_archive, auto_delete)
VALUES ('analytics_insights', 180, 0, 1);
