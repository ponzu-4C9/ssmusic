// 曲ごとの音量更新(PATCH) と 削除(DELETE)。

import { unlink } from "node:fs/promises";
import type { NextRequest } from "next/server";

import { resolveMediaPath } from "@/lib/media";
import { isAuthenticated } from "@/lib/session";
import { deleteTrack, updateTrackVolume } from "@/lib/tracks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const volume = (body as { volume?: unknown })?.volume;
  if (typeof volume !== "number" || Number.isNaN(volume)) {
    return Response.json({ error: "volume must be a number" }, { status: 400 });
  }

  const track = await updateTrackVolume(id, volume);
  if (!track) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ track });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const track = await deleteTrack(id);
  if (!track) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  // 音声ファイルも削除（存在しなくても無視）
  if (track.filePath) {
    try {
      await unlink(resolveMediaPath(track.filePath));
    } catch {
      // ファイルが無い等は無視
    }
  }

  return Response.json({ ok: true });
}
