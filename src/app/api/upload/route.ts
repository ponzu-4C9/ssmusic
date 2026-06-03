// ローカル MP3 のアップロード取り込み（複数可）。
// ファイルを MEDIA_DIR/<id>.mp3 に保存し、ffprobe で長さを取得して ready にする。

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

import { getAudioDurationSec } from "@/lib/ffprobe";
import { getMediaDir } from "@/lib/media";
import { isAuthenticated } from "@/lib/session";
import { createUploadTrack, deleteTrack, finalizeTrack } from "@/lib/tracks";

export const dynamic = "force-dynamic";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "フォームの読み取りに失敗しました" }, { status: 400 });
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return Response.json({ error: "ファイルがありません" }, { status: 400 });
  }

  const dir = getMediaDir();
  await mkdir(dir, { recursive: true });

  let added = 0;
  const skipped: { name: string; reason: string }[] = [];

  for (const file of files) {
    const name = file.name || "upload.mp3";
    const isMp3 = file.type === "audio/mpeg" || /\.mp3$/i.test(name);
    if (!isMp3) {
      skipped.push({ name, reason: "MP3 ではありません" });
      continue;
    }
    if (file.size > MAX_BYTES) {
      skipped.push({ name, reason: "200MB を超えています" });
      continue;
    }

    const title = name.replace(/\.[^.]+$/, "") || "（無題）";
    const track = await createUploadTrack(title);
    const filePath = path.join(dir, `${track.id}.mp3`);
    try {
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
      // ffprobe で読めない＝音声として認識できない → 失敗扱い（拡張子偽装の弾き）
      const durationSec = await getAudioDurationSec(filePath);
      if (durationSec === null) {
        throw new Error("音声ファイルとして認識できませんでした");
      }
      await finalizeTrack(track.id, {
        title,
        artist: null,
        durationSec,
        thumbnailUrl: null,
        sourceId: null,
        filePath: `${track.id}.mp3`,
      });
      added += 1;
    } catch (err) {
      // 失敗時は書き込み済みファイルと行を掃除（孤児・失敗行を残さない）
      await unlink(filePath).catch(() => {});
      await deleteTrack(track.id).catch(() => {});
      skipped.push({
        name,
        reason: err instanceof Error ? err.message : "保存に失敗しました",
      });
    }
  }

  return Response.json({ ok: true, added, skipped }, { status: 201 });
}
