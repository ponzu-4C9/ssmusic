// ログイン試行のレート制限（インメモリ・単一インスタンス前提）。
// インターネット公開時の総当たり攻撃を緩和する。
//
// キーの決め方は呼び出し側(login route)が管理する。信頼できるリバースプロキシが
// 無い直接公開では全リクエストを共通キーに集約するため、ヘッダ偽装では回避できない。

const WINDOW_MS = 15 * 60 * 1000; // 15 分
const MAX_ATTEMPTS = 10;
const MAX_KEYS = 10_000; // メモリ枯渇DoS対策の上限

interface Entry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, Entry>();

function sweepExpired(now: number): void {
  for (const [key, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(key);
  }
}

export function checkRateLimit(key: string): {
  ok: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();

  // キー数が膨らんだら期限切れを掃除（ヘッダ偽装での無限増殖を防ぐ）
  if (attempts.size > MAX_KEYS) sweepExpired(now);

  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterSec: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/** ログイン成功時にカウンタをリセットする。 */
export function resetRateLimit(key: string): void {
  attempts.delete(key);
}
