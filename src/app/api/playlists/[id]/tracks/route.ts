// プレイリストへの曲追加。

import type { NextRequest } from "next/server";

import { addTrackToPlaylist } from "@/lib/playlists";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const playlistId = Number((await ctx.params).id);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const trackId = Number((body as { trackId?: unknown })?.trackId);
  if (!Number.isInteger(playlistId) || !Number.isInteger(trackId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    await addTrackToPlaylist(playlistId, trackId);
  } catch {
    // 外部キー違反など（存在しない playlist / track）
    return Response.json(
      { error: "プレイリストまたは曲が見つかりません" },
      { status: 404 },
    );
  }
  return Response.json({ ok: true });
}
