// ワンタイムパスワードの一覧取得（GET）と発行（POST）。要認証。

import type { NextRequest } from "next/server";

import { issueCode, listCodes } from "@/lib/loginCodes";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const codes = await listCodes();
  return Response.json({ codes });
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let label: string | null = null;
  try {
    const body = (await req.json()) as { label?: unknown };
    if (typeof body?.label === "string") {
      const t = body.label.trim();
      label = t ? t.slice(0, 80) : null;
    }
  } catch {
    // ボディは任意（メモ無しでも発行可）
  }

  const { code, info } = await issueCode(label);
  return Response.json({ code, info }, { status: 201 });
}
