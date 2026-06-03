// ダウンロードジョブのインプロセス・キュー。
// 標準出力(standalone)の長寿命 Node サーバー前提。最大同時実行数を制限する。
// yt-dlp の出力は throttle しつつ tracks.log へ保存し、画面のコンソールで見られる。

import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { getMediaDir } from "@/lib/media";
import { finalizeTrack, setTrackLog, setTrackStatus } from "@/lib/tracks";
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

  // ログを蓄積し、最大 ~700ms ごとに DB へ書き込む（ライブ表示用）。
  // 書き込みは writeChain で直列化し、force flush が途中の書き込みと競合して
  // 古い（短い）ログで上書きされるのを防ぐ。
  let log = "";
  let lastWrite = 0;
  let writeChain: Promise<void> = Promise.resolve();
  const flush = (force: boolean): Promise<void> => {
    const now = Date.now();
    if (!force && now - lastWrite < 700) return writeChain;
    lastWrite = now;
    const snapshot = log;
    writeChain = writeChain.then(() =>
      setTrackLog(trackId, snapshot).catch(() => {
        // ログ保存失敗は致命ではない
      }),
    );
    return writeChain;
  };
  const onLog = (chunk: string) => {
    log += chunk;
    void flush(false);
  };

  try {
    await setTrackStatus(trackId, "downloading");
    onLog(`[ssmusic] 取り込み開始: ${url}\n`);

    const dir = getMediaDir();
    await mkdir(dir, { recursive: true });

    const meta = await fetchMetadata(url, onLog);
    const outPathNoExt = path.join(dir, String(trackId));
    await downloadAudio(url, outPathNoExt, onLog);

    const finalPath = `${outPathNoExt}.mp3`;
    try {
      await stat(finalPath);
    } catch {
      throw new Error("MP3 ファイルが生成されませんでした");
    }

    onLog(`[ssmusic] 完了: ${meta.title}\n`);
    await flush(true);

    const finalized = await finalizeTrack(trackId, {
      title: meta.title,
      artist: meta.uploader,
      durationSec: meta.durationSec,
      thumbnailUrl: meta.thumbnail,
      sourceId: meta.videoId,
      filePath: `${trackId}.mp3`,
    });

    if (!finalized) {
      // DL 中に行が削除されていた場合は生成済みファイルを掃除（孤児化を防ぐ）
      await unlink(finalPath).catch(() => {});
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "ダウンロードに失敗しました";
    onLog(`\n[ssmusic] エラー: ${message}\n`);
    await flush(true);
    await setTrackStatus(trackId, "error", message.slice(0, 500)).catch(
      () => {},
    );
  } finally {
    release();
  }
}
