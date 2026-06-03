// セッション管理（ステートレス署名 Cookie）。
// 単一の共有パスワードでログインするだけなので、セッションには
// 「認証済み」フラグと有効期限のみを入れる（ユーザー情報は持たない）。
// jose で HS256 署名し、HttpOnly Cookie に格納する。

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ssm_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 日

function getKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

/** 署名済みセッショントークンを生成する。 */
export async function createToken(): Promise<string> {
  return new SignJWT({ auth: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getKey());
}

/** トークンを検証する（proxy / route のどちらからでも使える純関数）。 */
export async function verifyToken(token?: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });
    return payload.auth === true;
  } catch {
    return false;
  }
}

/** ログイン成功時：Cookie にセッションをセットする。 */
export async function createSession(): Promise<void> {
  const token = await createToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SEC,
    path: "/",
  });
}

/** ログアウト時：Cookie を削除する。 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** 現在のリクエストが認証済みか（cookies() を使う server 専用）。 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(SESSION_COOKIE)?.value);
}
