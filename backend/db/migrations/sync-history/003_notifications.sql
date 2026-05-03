-- Migration 003: Paramètres de notification et log d'alertes
CREATE TABLE IF NOT EXISTS notification_settings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER,
  email             TEXT,
  slack_webhook     TEXT,
  teams_webhook     TEXT,
  enabled_sla_email INTEGER NOT NULL DEFAULT 0,
  enabled_sla_slack INTEGER NOT NULL DEFAULT 0,
  enabled_sla_teams INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alert_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL,
  channel     TEXT NOT NULL,
  sent_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_log_project ON alert_log(project_id, sent_at);
