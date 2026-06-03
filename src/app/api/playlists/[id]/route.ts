// プレイリストの詳細取得（曲つき） / 改名 / 削除。

import type { NextRequest } from "next/server";

import {
  deletePlaylist,
  getPlaylist,
  getPlaylistTracks,
  renamePlaylist,
} from "@/lib/playlists";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  const playlist = await getPlaylist(id);
  if (!playlist) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const tracks = await getPlaylistTracks(id);
  return Response.json({ playlist, tracks });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const name = (body as { name?: unknown })?.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "名前を入力してください" }, { status: 400 });
  }
  const ok = await renamePlaylist(id, name);
  if (!ok) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ playlist: await getPlaylist(id) });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  const ok = await deletePlaylist(id);
  if (!ok) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
