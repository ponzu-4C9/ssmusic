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

-- ワンタイムパスワード（共有パスワードを教えずに一時アクセスを渡すため）。
-- 平文は保存せず sha256 ハッシュのみ。1回使用 or 期限切れで無効。
CREATE TABLE IF NOT EXISTS login_codes (
  id         BIGSERIAL   PRIMARY KEY,
  code_hash  TEXT        NOT NULL UNIQUE,
  label      TEXT,                         -- 発行時のメモ（誰に渡したか等）
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ                   -- 使用日時（NULL = 未使用）
);

CREATE INDEX IF NOT EXISTS login_codes_created_at_idx ON login_codes (created_at DESC);

-- ログイン履歴（成功・失敗の両方を記録）。
CREATE TABLE IF NOT EXISTS login_events (
  id         BIGSERIAL   PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success    BOOLEAN     NOT NULL,
  method     TEXT,                         -- 'password' | 'code' | NULL（失敗）
  ip         TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS login_events_created_at_idx ON login_events (created_at DESC);
