// 曲一覧の取得。画面側はこれをポーリングして status を更新する。

import { isAuthenticated } from "@/lib/session";
import { listTracks } from "@/lib/tracks";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const tracks = await listTracks();
  return Response.json({ tracks });
}
