// ワンタイムパスワードの失効（未使用のものを削除）。要認証。

import type { NextRequest } from "next/server";

import { revokeCode } from "@/lib/loginCodes";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  await revokeCode(id);
  return Response.json({ ok: true });
}
