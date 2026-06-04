// アプリ全体で共有する型。
// DB 列(snake_case) ↔ アプリ(camelCase) の変換は src/lib/tracks.ts / playlists.ts で行う。

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
  /** yt-dlp の出力ログ（取り込み時に蓄積） */
  log: string | null;
  /** ISO 8601 文字列 */
  createdAt: string;
}

export interface Playlist {
  id: number;
  name: string;
  trackCount: number;
  createdAt: string;
}

/** プレイヤーのリピートモード */
export type RepeatMode = "off" | "all" | "one";

/** ワンタイムパスワードの状態 */
export type LoginCodeStatus = "active" | "used" | "expired";

/** 発行済みワンタイムパスワードのメタ情報（平文コードは含めない） */
export interface LoginCodeInfo {
  id: number;
  /** 発行時のメモ（誰に渡したか等） */
  label: string | null;
  /** ISO 8601 文字列 */
  createdAt: string;
  /** ISO 8601 文字列 */
  expiresAt: string;
  /** 使用日時（未使用なら null）。ISO 8601 文字列 */
  usedAt: string | null;
  status: LoginCodeStatus;
}

/** ログイン履歴の 1 件 */
export interface LoginEvent {
  id: number;
  /** ISO 8601 文字列 */
  createdAt: string;
  success: boolean;
  /** 'password' | 'code'（失敗時は null） */
  method: string | null;
  ip: string | null;
  userAgent: string | null;
}
