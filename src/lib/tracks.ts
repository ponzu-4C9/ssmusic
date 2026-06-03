// tracks テーブルのデータアクセス層（生 SQL）。
// DB 列(snake_case) を Track(camelCase) に変換して返す。

import { ensureSchema, query } from "@/lib/db";
import type { Track, TrackStatus } from "@/lib/types";

// SELECT * / RETURNING * を避け、列を明示する（スキーマ変更時のドリフトを検知しやすく）。
// 一覧用カラム（log は大きくなるので含めない。log は getTrackById / ログ専用で取得）。
const COLUMNS =
  "id, title, artist, source_url, source_id, file_path, duration_sec, volume, thumbnail_url, status, error, created_at";

interface TrackRow {
  id: string; // BIGSERIAL は pg では文字列で返る
  title: string;
  artist: string | null;
  source_url: string | null;
  source_id: string | null;
  file_path: string | null;
  duration_sec: number | null;
  volume: number;
  thumbnail_url: string | null;
  status: TrackStatus;
  error: string | null;
  log: string | null;
  created_at: Date;
}

function mapRow(r: TrackRow): Track {
  return {
    id: Number(r.id),
    title: r.title,
    artist: r.artist,
    sourceUrl: r.source_url,
    sourceId: r.source_id,
    filePath: r.file_path,
    durationSec: r.duration_sec,
    volume: r.volume,
    thumbnailUrl: r.thumbnail_url,
    status: r.status,
    error: r.error,
    log: r.log ?? null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  };
}

export async function listTracks(): Promise<Track[]> {
  await ensureSchema();
  const { rows } = await query<TrackRow>(
    `SELECT ${COLUMNS} FROM tracks ORDER BY created_at DESC, id DESC`,
  );
  return rows.map(mapRow);
}

export async function getTrackById(id: number): Promise<Track | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  await ensureSchema();
  const { rows } = await query<TrackRow>(
    `SELECT ${COLUMNS}, log FROM tracks WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** ダウンロード待ちの行を作成して返す（id を確定させるため）。 */
export async function createQueuedTrack(url: string): Promise<Track> {
  await ensureSchema();
  const { rows } = await query<TrackRow>(
    `INSERT INTO tracks (title, source_url, status)
     VALUES ($1, $2, 'queued')
     RETURNING ${COLUMNS}`,
    ["（取得中…）", url],
  );
  return mapRow(rows[0]);
}

/** アップロード等で、タイトルを指定して ready 直前の行を作る（source_url は無し）。 */
export async function createUploadTrack(title: string): Promise<Track> {
  await ensureSchema();
  const { rows } = await query<TrackRow>(
    `INSERT INTO tracks (title, status) VALUES ($1, 'queued') RETURNING ${COLUMNS}`,
    [title || "（無題）"],
  );
  return mapRow(rows[0]);
}

/** yt-dlp の出力ログを保存する（取り込み中に逐次更新）。 */
export async function setTrackLog(id: number, log: string): Promise<void> {
  await ensureSchema();
  await query("UPDATE tracks SET log = $2 WHERE id = $1", [id, log]);
}

export async function updateTrackVolume(
  id: number,
  volume: number,
): Promise<Track | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  await ensureSchema();
  const v = Math.max(0, Math.min(100, Math.round(volume)));
  const { rows } = await query<TrackRow>(
    `UPDATE tracks SET volume = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, v],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteTrack(id: number): Promise<Track | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  await ensureSchema();
  const { rows } = await query<TrackRow>(
    `DELETE FROM tracks WHERE id = $1 RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function setTrackStatus(
  id: number,
  status: TrackStatus,
  error: string | null = null,
): Promise<void> {
  await ensureSchema();
  await query("UPDATE tracks SET status = $2, error = $3 WHERE id = $1", [
    id,
    status,
    error,
  ]);
}

/**
 * ダウンロード完了時の確定更新。
 * 更新できた行数を返す（0 のときは行が削除済み = 呼び出し側でファイルを掃除する）。
 */
export async function finalizeTrack(
  id: number,
  data: {
    title: string;
    artist: string | null;
    durationSec: number | null;
    thumbnailUrl: string | null;
    sourceId: string | null;
    filePath: string;
  },
): Promise<boolean> {
  await ensureSchema();
  const res = await query(
    `UPDATE tracks
     SET title = $2, artist = $3, duration_sec = $4, thumbnail_url = $5,
         source_id = $6, file_path = $7, status = 'ready', error = NULL
     WHERE id = $1`,
    [
      id,
      data.title,
      data.artist,
      data.durationSec,
      data.thumbnailUrl,
      data.sourceId,
      data.filePath,
    ],
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * サーバー再起動で中断された未完了ジョブを error に倒し、対象 id を返す。
 * 呼び出し側(instrumentation)が残骸ファイルを掃除するのに使う。
 */
export async function reclaimInterruptedDownloads(): Promise<number[]> {
  await ensureSchema();
  const { rows } = await query<{ id: string }>(
    `UPDATE tracks
     SET status = 'error', error = 'サーバー再起動により中断されました'
     WHERE status IN ('queued', 'downloading')
     RETURNING id`,
  );
  return rows.map((r) => Number(r.id));
}

// playlists.ts から行マッピングを再利用するためのエクスポート
export { mapRow as mapTrackRow };
export type { TrackRow };
