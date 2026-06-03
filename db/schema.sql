-- ============================================================
-- DB スキーマ（人間向けの正本）。
-- アプリ起動時に src/lib/db.ts の ensureSchema() が
-- 同等の DDL を冪等に実行するため、このファイルを手動で流す必要は通常ありません。
-- （src/lib/db.ts の SCHEMA_DDL と内容を一致させること）
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
  log           TEXT,                         -- yt-dlp の取り込みログ
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracks_created_at_idx ON tracks (created_at DESC);

-- 既存DBにも log 列を追加（冪等）
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS log TEXT;

-- プレイリスト
CREATE TABLE IF NOT EXISTS playlists (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id BIGINT      NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    BIGINT      NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
  position    INTEGER     NOT NULL DEFAULT 0,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, track_id)
);

CREATE INDEX IF NOT EXISTS playlist_tracks_order_idx
  ON playlist_tracks (playlist_id, position, added_at);
