// アプリ全体で共有する型。
// DB 列(snake_case) ↔ アプリ(camelCase) の変換は src/lib/tracks.ts で行う。

export type TrackStatus = "queued" | "downloading" | "ready" | "error";

export interface Track {
  id: number;
  title: string;
  artist: string | null;
  sourceUrl: string | null;
  sourceId: string | null;
  filePath: string | null;
  durationSec: number | null;
  /** 0..100 の音量（曲ごと） */
  volume: number;
  thumbnailUrl: string | null;
  status: TrackStatus;
  error: string | null;
  /** ISO 8601 文字列 */
  createdAt: string;
}
