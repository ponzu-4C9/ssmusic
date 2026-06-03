// 共有パスワードによるログイン。
// レート制限 → 定数時間比較 → セッション Cookie 発行。

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { checkRateLimit, resetRateLimit } from "@/lib/ratelimit";
import { createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function clientKey(req: NextRequest): string {
  // 信頼できるリバースプロキシの背後にいるときだけ転送ヘッダを信用する。
  // 直接公開時は偽装可能な x-forwarded-for / x-real-ip を一切信用せず、
  // 全リクエストを共通キーに集約する。これにより 10回/15分 の制限が
  // ヘッダ書き換えでは回避できなくなる（= 実質的な総当たり上限になる）。
  if (process.env.TRUST_PROXY === "1") {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return req.headers.get("x-real-ip") || "proxy-unknown";
  }
  return "direct";
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  const key = clientKey(req);
  const rl = checkRateLimit(key);
  if (!rl.ok) {
    return Response.json(
      { error: `試行回数が多すぎます。${rl.retryAfterSec} 秒後に再試行してください。` },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const password =
    typeof (body as { password?: unknown })?.password === "string"
      ? (body as { password: string }).password
      : "";

  const expected = process.env.APP_PASSWORD || "";
  if (!expected) {
    return Response.json(
      { error: "サーバーで APP_PASSWORD が設定されていません" },
      { status: 500 },
    );
  }

  if (!safeEqual(password, expected)) {
    return Response.json({ error: "パスワードが違います" }, { status: 401 });
  }

  resetRateLimit(key);
  await createSession();
  return Response.json({ ok: true });
}
