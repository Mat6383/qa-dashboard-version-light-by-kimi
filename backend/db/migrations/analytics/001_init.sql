CREATE TABLE IF NOT EXISTS analytics_insights (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('trend','pattern','recommendation','anomaly')),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  confidence    REAL DEFAULT 0.8,
  data_json     TEXT,
  read          INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insights_project ON analytics_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_insights_read ON analytics_insights(read);
CREATE INDEX IF NOT EXISTS idx_insights_created ON analytics_insights(created_at);
