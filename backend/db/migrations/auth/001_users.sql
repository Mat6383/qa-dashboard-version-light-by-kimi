-- Migration 001: Table utilisateurs (OAuth GitLab)
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  gitlab_id   INTEGER NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  name        TEXT,
  avatar      TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_gitlab_id ON users(gitlab_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
