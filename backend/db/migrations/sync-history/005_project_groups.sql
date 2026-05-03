-- Migration 005: Groupes de projets (portefeuilles / équipes)
CREATE TABLE IF NOT EXISTS project_groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  project_ids TEXT NOT NULL, -- JSON array [1, 2, 3]
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
