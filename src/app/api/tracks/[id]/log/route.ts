// 取り込みログの取得（コンソール表示用）。DL 中はコンソールがこれをポーリングする。

import type { NextRequest } from "next/server";

import { isAuthenticated } from "@/lib/session";
import { getTrackById } from "@/lib/tracks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  const track = await getTrackById(id);
  if (!track) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({
    status: track.status,
    title: track.title,
    log: track.log ?? "",
  });
}
