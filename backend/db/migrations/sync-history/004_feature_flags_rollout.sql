-- ================================================
-- Migration 004: Feature Flags — Rollout % + created_at
-- ================================================

ALTER TABLE feature_flags ADD COLUMN rollout_percentage INTEGER NOT NULL DEFAULT 100;
ALTER TABLE feature_flags ADD COLUMN created_at TEXT;

-- Backfill created_at sur les lignes existantes
UPDATE feature_flags SET created_at = updated_at WHERE created_at IS NULL;
