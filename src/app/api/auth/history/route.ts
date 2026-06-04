// ログイン履歴の取得（GET）。要認証。

import { listLoginEvents } from "@/lib/loginEvents";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const events = await listLoginEvents(50);
  return Response.json({ events });
}
