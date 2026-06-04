// ワンタイムパスワード（OTP）のデータアクセス層（生 SQL）。
// 共有パスワードを教えずに「一時的なログイン」を渡すための仕組み。
// - 平文コードは DB に保存しない（sha256 ハッシュのみ）。発行時に一度だけ返す。
// - 1 回使用 or 期限切れで無効。
// - 紛らわしい文字を除いたアルファベットで生成し、人が読み書きしやすくする。

import { createHash, randomBytes } from "node:crypto";

import { ensureSchema, query } from "@/lib/db";
import type { LoginCodeInfo, LoginCodeStatus } from "@/lib/types";

// 0/O/1/I/L/U など紛らわしい文字を除外（Crockford 風）
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LEN = 8; // 約 30^8 ≒ 6.5e11 通り（1回限り＋期限＋レート制限で十分）
/** 発行から有効な秒数（24 時間） */
export const CODE_TTL_SEC = 24 * 60 * 60;

interface LoginCodeRow {
  id: string; // BIGSERIAL は pg では文字列
  label: string | null;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
}

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

/** 入力を照合用に正規化（大文字化＋英数字以外を除去）。ハイフンや空白を許容する。 */
function normalize(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function hashCode(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

/** 紛らわしくない文字で XXXX-XXXX 形式のコードを生成する。 */
function generateCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let s = "";
  for (let i = 0; i < CODE_LEN; i += 1) {
    s += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function mapRow(r: LoginCodeRow): LoginCodeInfo {
  const expiresAt = toIso(r.expires_at);
  const usedAt = r.used_at ? toIso(r.used_at) : null;
  let status: LoginCodeStatus;
  if (usedAt) status = "used";
  else if (new Date(expiresAt).getTime() <= Date.now()) status = "expired";
  else status = "active";
  return {
    id: Number(r.id),
    label: r.label,
    createdAt: toIso(r.created_at),
    expiresAt,
    usedAt,
    status,
  };
}

const COLUMNS = "id, label, created_at, expires_at, used_at";

/** OTP を発行する。平文コードは戻り値でのみ返す（保存はハッシュのみ）。 */
export async function issueCode(
  label: string | null,
): Promise<{ code: string; info: LoginCodeInfo }> {
  await ensureSchema();
  // ハッシュ衝突（極めて稀）に備えて数回リトライ
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    const hash = hashCode(normalize(code));
    try {
      const { rows } = await query<LoginCodeRow>(
        `INSERT INTO login_codes (code_hash, label, expires_at)
         VALUES ($1, $2, now() + ($3::int * interval '1 second'))
         RETURNING ${COLUMNS}`,
        [hash, label, CODE_TTL_SEC],
      );
      return { code, info: mapRow(rows[0]) };
    } catch (err) {
      // unique_violation (23505) のときだけ再試行
      if ((err as { code?: string })?.code === "23505") continue;
      throw err;
    }
  }
  throw new Error("コードの発行に失敗しました");
}

/** 発行済みコードの一覧（新しい順・最大 50 件）。平文は返さない。 */
export async function listCodes(limit = 50): Promise<LoginCodeInfo[]> {
  await ensureSchema();
  const { rows } = await query<LoginCodeRow>(
    `SELECT ${COLUMNS} FROM login_codes ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit],
  );
  return rows.map(mapRow);
}

/**
 * コードを消費する（ログイン時）。未使用かつ未期限のものだけを 1 件だけ
 * アトミックに使用済みへ更新する。成功時 true。
 */
export async function consumeCode(rawInput: string): Promise<boolean> {
  const normalized = normalize(rawInput);
  // コード長に満たない入力は照合不要（通常パスワードの誤入力など）
  if (normalized.length < CODE_LEN) return false;
  await ensureSchema();
  const hash = hashCode(normalized);
  const res = await query(
    `UPDATE login_codes SET used_at = now()
     WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hash],
  );
  return (res.rowCount ?? 0) > 0;
}

/** 未使用コードを失効（削除）する。使用済みは履歴として残す。 */
export async function revokeCode(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  await ensureSchema();
  await query("DELETE FROM login_codes WHERE id = $1 AND used_at IS NULL", [id]);
}
