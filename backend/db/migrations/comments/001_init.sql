-- Migration 001: Initialisation crosstest_comments
CREATE TABLE IF NOT EXISTS crosstest_comments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_iid         INTEGER NOT NULL,
  gitlab_project_id INTEGER NOT NULL DEFAULT 63,
  milestone_context TEXT,
  comment           TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE(issue_iid, gitlab_project_id)
);

CREATE INDEX IF NOT EXISTS idx_crosstest_comments_issue
  ON crosstest_comments(issue_iid, gitlab_project_id);
