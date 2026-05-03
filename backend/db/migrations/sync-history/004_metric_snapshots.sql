-- Migration 004: Snapshots métriques pour tendances historiques
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL,
  date            TEXT NOT NULL DEFAULT (date('now')),
  pass_rate       REAL,
  completion_rate REAL,
  escape_rate     REAL,
  detection_rate  REAL,
  blocked_rate    REAL,
  total_tests     INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_snapshots_project_date ON metric_snapshots(project_id, date);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_date ON metric_snapshots(date);
