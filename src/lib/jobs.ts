// ダウンロードジョブのインプロセス・キュー。
// 標準出力(standalone)の長寿命 Node サーバー前提。最大同時実行数を制限する。

import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { getMediaDir } from "@/lib/media";
import { finalizeTrack, setTrackStatus } from "@/lib/tracks";
import { downloadAudio, fetchMetadata } from "@/lib/ytdlp";

const MAX_CONCURRENT = 2;
let active = 0;
const waiting: Array<() => void> = [];

function acquire(): Promise<void> {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENT) {
      active += 1;
      resolve();
    } else {
      waiting.push(() => {
        active += 1;
        resolve();
      });
    }
  });
}

function release(): void {
  active -= 1;
  const next = waiting.shift();
  if (next) next();
}

/** ダウンロードをキューに積む（fire-and-forget）。 */
export function enqueueDownload(trackId: number, url: string): void {
  void runJob(trackId, url);
}

async function runJob(trackId: number, url: string): Promise<void> {
  await acquire();
  try {
    await setTrackStatus(trackId, "downloading");

    const dir = getMediaDir();
    await mkdir(dir, { recursive: true });

    const meta = await fetchMetadata(url);
    const outPathNoExt = path.join(dir, String(trackId));
    await downloadAudio(url, outPathNoExt);

    // 期待した MP3 が実在するか検証（無ければ error に倒す）
    const finalPath = `${outPathNoExt}.mp3`;
    try {
      await stat(finalPath);
    } catch {
      throw new Error(
        "ダウンロードは完了しましたが MP3 ファイルが見つかりませんでした",
      );
    }

    const finalized = await finalizeTrack(trackId, {
      title: meta.title,
      artist: meta.uploader,
      durationSec: meta.durationSec,
      thumbnailUrl: meta.thumbnail,
      sourceId: meta.videoId,
      filePath: `${trackId}.mp3`,
    });

    // DL 中に行が削除されていた場合は生成済みファイルを掃除（孤児化を防ぐ）
    if (!finalized) {
      await unlink(finalPath).catch(() => {});
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "ダウンロードに失敗しました";
    await setTrackStatus(trackId, "error", message.slice(0, 500)).catch(() => {
      // 失敗ステータスの更新自体に失敗しても握りつぶす
    });
  } finally {
    release();
  }
}
