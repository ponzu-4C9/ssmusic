// yt-dlp ラッパー。
// セキュリティ：ユーザー入力(URL)は spawn の引数配列で渡し、シェルを経由しない
// （コマンドインジェクション対策）。さらに URL は YouTube 系ホストのみ許可する。
// 取り込みの様子（stdout/stderr）は onLog コールバックへ逐次流す。

import { spawn } from "node:child_process";

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

type LogFn = (chunk: string) => void;

// YouTube の JavaScript challenge を解決するため、コンテナに同梱された
// Node.js を明示的に有効化する（yt-dlp は Node を自動では有効化しない）。
const YT_DLP_COMMON_ARGS = ["--js-runtimes", "node"] as const;

/** yt-dlp を spawn し、stderr（と任意で stdout）を onLog に流す。stdout を返す。 */
function runYtDlp(
  args: string[],
  opts: { onLog: LogFn; logStdout: boolean; timeoutMs: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    // detached: 独立プロセスグループにして、timeout 時に yt-dlp が起動した
    // ffmpeg などの子プロセスもまとめて kill できるようにする。
    const child = spawn("yt-dlp", [...YT_DLP_COMMON_ARGS, ...args], {
      detached: true,
    });
    let stdout = "";
    let settled = false;

    const killTree = () => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => {
        killTree();
        reject(new Error("yt-dlp がタイムアウトしました"));
      });
    }, opts.timeoutMs);

    child.stdout.on("data", (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      if (opts.logStdout) opts.onLog(s);
    });
    child.stderr.on("data", (d: Buffer) => opts.onLog(d.toString()));
    child.on("error", (err) => finish(() => reject(err)));
    child.on("close", (code) => {
      finish(() => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`yt-dlp が終了コード ${code} で失敗しました`));
      });
    });
  });
}

/** 動画のメタデータのみ取得（JSON）。stdout は巨大なのでログには流さない。 */
export async function fetchMetadata(url: string, onLog: LogFn): Promise<YtMeta> {
  onLog(`$ yt-dlp --js-runtimes node -J --no-playlist ${url}\n`);
  const stdout = await runYtDlp(["-J", "--no-playlist", url], {
    onLog,
    logStdout: false,
    timeoutMs: 60_000,
  });
  const j = JSON.parse(stdout) as YtDumpJson;
  return {
    title: j.title?.trim() || "Untitled",
    uploader: j.uploader || j.channel || null,
    durationSec: typeof j.duration === "number" ? Math.round(j.duration) : null,
    thumbnail: j.thumbnail || null,
    videoId: j.id || null,
  };
}

/** 音声を MP3 として `${outPathNoExt}.mp3` にダウンロードする。 */
export async function downloadAudio(
  url: string,
  outPathNoExt: string,
  onLog: LogFn,
): Promise<void> {
  onLog(
    `\n$ yt-dlp --js-runtimes node -x --audio-format mp3 -o <id>.%(ext)s ${url}\n`,
  );
  await runYtDlp(
    [
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--no-playlist",
      "--no-progress",
      "-o",
      `${outPathNoExt}.%(ext)s`,
      url,
    ],
    { onLog, logStdout: true, timeoutMs: 600_000 },
  );
}
