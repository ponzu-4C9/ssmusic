// サーバー起動時に一度だけ実行される（Next.js の instrumentation）。
// DB スキーマを用意し、再起動で中断された未完了ジョブと残骸ファイルを片付ける。

export async function register(): Promise<void> {
  // Node.js ランタイムのときだけ実行（Edge では pg を読み込まない）
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureSchema } = await import("@/lib/db");
  const { reclaimInterruptedDownloads } = await import("@/lib/tracks");

  // DB がまだ起動していない可能性に備えて指数バックオフでリトライ
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await ensureSchema();
      const ids = await reclaimInterruptedDownloads();
      if (ids.length > 0) await cleanupOrphanFiles(ids);
      return;
    } catch (err) {
      if (attempt === 5) {
        // 最終的に失敗しても致命ではない（クエリ時に ensureSchema が再試行される）
        console.error("[instrumentation] startup init failed:", err);
        return;
      }
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 15000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/** 中断されたダウンロードの残骸ファイル(<id>.*)を削除する。 */
async function cleanupOrphanFiles(ids: number[]): Promise<void> {
  try {
    const { getMediaDir } = await import("@/lib/media");
    const { readdir, unlink } = await import("node:fs/promises");
    const path = await import("node:path");

    const dir = getMediaDir();
    const idSet = new Set(ids.map(String));
    const names = await readdir(dir).catch(() => [] as string[]);

    for (const name of names) {
      const base = name.split(".")[0];
      if (idSet.has(base)) {
        await unlink(path.join(dir, name)).catch(() => {});
      }
    }
  } catch {
    // 掃除失敗は致命ではない
  }
}
