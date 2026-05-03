CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
  actor_id      INTEGER,
  actor_email   TEXT,
  actor_role    TEXT,
  action        TEXT NOT NULL,
  resource      TEXT,
  resource_id   TEXT,
  method        TEXT,
  path          TEXT,
  ip            TEXT,
  user_agent    TEXT,
  status_code   INTEGER,
  details       TEXT,
  success       INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
