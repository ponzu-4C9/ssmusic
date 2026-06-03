// Next.js 16 の proxy（旧 middleware）。Node.js ランタイムで動作する。
// ページへのアクセスを楽観的にゲートし、未認証なら /login へリダイレクトする。
// ※ API ルートは matcher から除外し、各ルート内で 401 を返して保護する
//   （fetch をリダイレクトで壊さないため）。

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    // ログイン済みでログインページに来たらトップへ
    if (authed) return NextResponse.redirect(new URL("/", req.nextUrl));
    return NextResponse.next();
  }

  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // api / 静的アセット / manifest / アイコンには適用しない
  matcher: [
    "/((?!api|_next/static|_next/image|manifest\\.webmanifest|icon\\.svg|favicon\\.ico|.*\\.png$).*)",
  ],
};
