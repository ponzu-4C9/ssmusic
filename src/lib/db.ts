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
