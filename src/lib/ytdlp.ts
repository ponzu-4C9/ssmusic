// yt-dlp ラッパー。
// セキュリティ：ユーザー入力(URL)は execFile の引数配列で渡し、シェルを経由しない
// （コマンドインジェクション対策）。さらに URL は YouTube 系ホストのみ許可する。

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

export function isValidYouTubeUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  return ALLOWED_HOSTS.has(u.hostname.toLowerCase());
}

export interface YtMeta {
  title: string;
  uploader: string | null;
  durationSec: number | null;
  thumbnail: string | null;
  videoId: string | null;
}

interface YtDumpJson {
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  id?: string;
}

/** 動画のメタデータのみ取得する（ダウンロードはしない）。 */
export async function fetchMetadata(url: string): Promise<YtMeta> {
  const { stdout } = await execFileAsync(
    "yt-dlp",
    ["-J", "--no-playlist", "--no-warnings", url],
    { maxBuffer: 64 * 1024 * 1024, timeout: 60_000 },
  );
  const j = JSON.parse(stdout) as YtDumpJson;
  return {
    title: j.title?.trim() || "Untitled",
    uploader: j.uploader || j.channel || null,
    durationSec:
      typeof j.duration === "number" ? Math.round(j.duration) : null,
    thumbnail: j.thumbnail || null,
    videoId: j.id || null,
  };
}

/**
 * 音声を MP3 として `${outPathNoExt}.mp3` にダウンロードする。
 * outPathNoExt は拡張子なしの絶対パス（例: /app/media/12）。
 */
export async function downloadAudio(
  url: string,
  outPathNoExt: string,
): Promise<void> {
  await execFileAsync(
    "yt-dlp",
    [
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      "-o",
      `${outPathNoExt}.%(ext)s`,
      url,
    ],
    { maxBuffer: 64 * 1024 * 1024, timeout: 600_000 },
  );
}
