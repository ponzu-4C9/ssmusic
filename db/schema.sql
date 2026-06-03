-- ============================================================
-- DB スキーマ（人間向けの正本）。
-- アプリ起動時に src/lib/db.ts の ensureSchema() が
-- 同等の CREATE TABLE IF NOT EXISTS を冪等に実行するため、
-- このファイルを手動で流す必要は通常ありません。
-- ============================================================

CREATE TABLE IF NOT EXISTS tracks (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT        NOT NULL,
  artist        TEXT,
  source_url    TEXT,
  source_id     TEXT,                         -- YouTube の video id
  file_path     TEXT,                         -- MEDIA_DIR からの相対パス（例: 12.mp3）
  duration_sec  INTEGER,
  volume        INTEGER     NOT NULL DEFAULT 100,  -- 0..100（曲ごとの音量）
  thumbnail_url TEXT,
  status        TEXT        NOT NULL DEFAULT 'ready',  -- queued | downloading | ready | error
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracks_created_at_idx ON tracks (created_at DESC);
