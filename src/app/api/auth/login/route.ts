// ログイン。共有パスワード または ワンタイムパスワード(OTP) を受け付ける。
// レート制限 → 共有パスワード(定数時間比較) → OTP消費 → セッション Cookie 発行。
// 成功・失敗ともログイン履歴(login_events)に記録する（記録はベストエフォート）。

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { consumeCode } from "@/lib/loginCodes";
import { recordLoginEvent } from "@/lib/loginEvents";
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

/** 履歴表示用のクライアント IP（取れないときは null）。 */
function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || null;
  return req.headers.get("x-real-ip");
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

  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");

  // 1) 共有パスワード（定数時間比較）
  if (safeEqual(password, expected)) {
    resetRateLimit(key);
    await createSession();
    await recordLoginEvent({ success: true, method: "password", ip, userAgent });
    return Response.json({ ok: true });
  }

  // 2) ワンタイムパスワード（未使用・未期限のものを 1 回だけ消費）。
  //    DB 障害時は false 扱いにしてログイン全体を壊さない。
  let codeOk = false;
  try {
    codeOk = await consumeCode(password);
  } catch {
    codeOk = false;
  }
  if (codeOk) {
    resetRateLimit(key);
    await createSession();
    await recordLoginEvent({ success: true, method: "code", ip, userAgent });
    return Response.json({ ok: true });
  }

  await recordLoginEvent({ success: false, method: null, ip, userAgent });
  return Response.json({ error: "パスワードが違います" }, { status: 401 });
}
