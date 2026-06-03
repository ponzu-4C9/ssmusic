// YouTube URL を受け取り、ダウンロードジョブを開始する。
// すぐに 202 を返し、実際のダウンロードはバックグラウンドで進める。

import type { NextRequest } from "next/server";

import { enqueueDownload } from "@/lib/jobs";
import { isAuthenticated } from "@/lib/session";
import { createQueuedTrack } from "@/lib/tracks";
import { isValidYouTubeUrl } from "@/lib/ytdlp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const url =
    typeof (body as { url?: unknown })?.url === "string"
      ? (body as { url: string }).url.trim()
      : "";

  if (!isValidYouTubeUrl(url)) {
    return Response.json(
      { error: "YouTube の URL を入力してください" },
      { status: 400 },
    );
  }

  const track = await createQueuedTrack(url);
  enqueueDownload(track.id, url);

  return Response.json({ track }, { status: 202 });
}
