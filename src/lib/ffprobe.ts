// ffprobe（ffmpeg 同梱）で音声ファイルの長さ(秒)を取得する。
// アップロードされた MP3 の duration 取得に使用。

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getAudioDurationSec(
  filePath: string,
): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        filePath,
      ],
      { timeout: 30_000 },
    );
    const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
    const d = parsed.format?.duration;
    const n = d ? Number(d) : NaN;
    return Number.isFinite(n) ? Math.round(n) : null;
  } catch {
    return null;
  }
}
