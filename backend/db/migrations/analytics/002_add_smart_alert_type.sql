-- Ajoute le type 'smart_alert' pour les insights générés par SmartAlertsService
-- SQLite : recréation de la table car ALTER TABLE DROP CONSTRAINT n'est pas supporté.

PRAGMA foreign_keys = OFF;

CREATE TABLE analytics_insights_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('trend','pattern','recommendation','anomaly','smart_alert')),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  confidence    REAL DEFAULT 0.8,
  data_json     TEXT,
  read          INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

INSERT INTO analytics_insights_new
  SELECT * FROM analytics_insights;

DROP TABLE analytics_insights;

ALTER TABLE analytics_insights_new RENAME TO analytics_insights;

CREATE INDEX IF NOT EXISTS idx_insights_project ON analytics_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_insights_read ON analytics_insights(read);
CREATE INDEX IF NOT EXISTS idx_insights_created ON analytics_insights(created_at);

PRAGMA foreign_keys = ON;
