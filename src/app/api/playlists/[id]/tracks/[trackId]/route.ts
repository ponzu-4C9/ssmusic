// プレイリストから曲を除外。

import type { NextRequest } from "next/server";

import { removeTrackFromPlaylist } from "@/lib/playlists";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; trackId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, trackId } = await ctx.params;
  await removeTrackFromPlaylist(Number(id), Number(trackId));
  return Response.json({ ok: true });
}
