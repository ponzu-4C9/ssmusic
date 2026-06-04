// PostgreSQL 接続（生 pg）。
// - Pool は遅延生成（最初のクエリ時に DATABASE_URL を読む = ビルド時ではなく実行時）。
// - ensureSchema() は冪等な DDL を一度だけ実行し、テーブルの存在を保証する。

import { Pool, type QueryResultRow } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return params
    ? getPool().query<T>(text, params)
    : getPool().query<T>(text);
}

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS tracks (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT        NOT NULL,
  artist        TEXT,
  source_url    TEXT,
  source_id     TEXT,
  file_path     TEXT,
  duration_sec  INTEGER,
  volume        INTEGER     NOT NULL DEFAULT 100,
  thumbnail_url TEXT,
  status        TEXT        NOT NULL DEFAULT 'ready',
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tracks_created_at_idx ON tracks (created_at DESC);

-- 既存DBにも yt-dlp ログ列を追加
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
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
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
`;

let schemaReady: Promise<void> | undefined;

/** 冪等にスキーマを作成する。並行呼び出しでも一度しか走らない。 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await getPool().query(SCHEMA_DDL);
    })().catch((err) => {
      // 失敗時は次回再試行できるようにキャッシュを解除
      schemaReady = undefined;
      throw err;
    });
  }
  return schemaReady;
}
