// プレイリスト一覧の取得 / 作成。

import type { NextRequest } from "next/server";

import { createPlaylist, listPlaylists } from "@/lib/playlists";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({ playlists: await listPlaylists() });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
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
  const playlist = await createPlaylist(name);
  return Response.json({ playlist }, { status: 201 });
}
