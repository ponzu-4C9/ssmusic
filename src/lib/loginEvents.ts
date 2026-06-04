// ログイン履歴のデータアクセス層（生 SQL）。
// 成功・失敗の両方を記録する。記録は「ベストエフォート」で、
// DB 障害時でもログイン自体を妨げないように呼び出し側で扱う。

import { ensureSchema, query } from "@/lib/db";
import type { LoginEvent } from "@/lib/types";

interface LoginEventRow {
  id: string;
  created_at: Date;
  success: boolean;
  method: string | null;
  ip: string | null;
  user_agent: string | null;
}

function mapRow(r: LoginEventRow): LoginEvent {
  return {
    id: Number(r.id),
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
    success: r.success,
    method: r.method,
    ip: r.ip,
    userAgent: r.user_agent,
  };
}

/** ログイン試行を記録する。失敗してもログイン処理を妨げない（例外は飲み込む）。 */
export async function recordLoginEvent(e: {
  success: boolean;
  method: string | null;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  try {
    await ensureSchema();
    await query(
      `INSERT INTO login_events (success, method, ip, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [
        e.success,
        e.method,
        e.ip,
        e.userAgent ? e.userAgent.slice(0, 400) : null,
      ],
    );
  } catch {
    // 記録失敗は致命ではない
  }
}

/** 最近のログイン履歴（新しい順）。 */
export async function listLoginEvents(limit = 50): Promise<LoginEvent[]> {
  await ensureSchema();
  const { rows } = await query<LoginEventRow>(
    `SELECT id, created_at, success, method, ip, user_agent
     FROM login_events ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit],
  );
  return rows.map(mapRow);
}
