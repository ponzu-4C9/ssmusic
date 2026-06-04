"use client";

import { useCallback, useEffect, useState } from "react";

import { formatDateTime } from "@/lib/format";
import type { LoginCodeInfo, LoginEvent } from "@/lib/types";

function StatusBadge({ status }: { status: LoginCodeInfo["status"] }) {
  const map = {
    active: { label: "有効", cls: "bg-green-500/15 text-green-400" },
    used: { label: "使用済み", cls: "bg-zinc-700/60 text-zinc-400" },
    expired: { label: "期限切れ", cls: "bg-zinc-700/60 text-zinc-500" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function methodLabel(method: string | null): string {
  if (method === "password") return "パスワード";
  if (method === "code") return "ワンタイム";
  return "—";
}

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const [codes, setCodes] = useState<LoginCodeInfo[]>([]);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [label, setLabel] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/codes", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { codes: LoginCodeInfo[] };
      setCodes(data.codes ?? []);
    } catch {
      // ignore
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/history", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { events: LoginEvent[] };
      setEvents(data.events ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.all([loadCodes(), loadEvents()]);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadCodes, loadEvents]);

  async function issue() {
    setIssuing(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/auth/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "発行に失敗しました");
        return;
      }
      setIssued(data.code as string);
      setLabel("");
      await loadCodes();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIssuing(false);
    }
  }

  async function revoke(id: number) {
    try {
      await fetch(`/api/auth/codes/${id}`, { method: "DELETE" });
    } catch {
      // ignore
    }
    await loadCodes();
  }

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボード不可（非 HTTPS 等）。手動コピーに任せる。
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative my-auto w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-base font-semibold">アカウント</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            閉じる
          </button>
        </div>

        <div className="max-h-[75vh] space-y-6 overflow-y-auto px-5 py-5">
          {/* ===== ワンタイムパスワード ===== */}
          <section>
            <h3 className="text-sm font-semibold">ワンタイムパスワード</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              共有パスワードを教えずに一時的なログインを渡せます。
              発行したコードは <strong className="text-zinc-300">24時間有効・1回だけ</strong>{" "}
              使えます。
            </p>

            {issued && (
              <div className="mt-3 rounded-xl border border-green-600/40 bg-green-500/10 p-3">
                <div className="text-[11px] text-green-300">
                  発行しました（この画面を閉じると再表示できません）
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 select-all rounded-lg bg-black/40 px-3 py-2 text-center font-mono text-lg font-semibold tracking-[0.2em] text-green-300">
                    {issued}
                  </code>
                  <button
                    type="button"
                    onClick={copy}
                    className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500"
                  >
                    {copied ? "コピー済" : "コピー"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="メモ（任意・誰に渡すか等）"
                maxLength={80}
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
              <button
                type="button"
                onClick={issue}
                disabled={issuing}
                className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
              >
                {issuing ? "発行中…" : "発行する"}
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            {/* 発行済み一覧 */}
            <div className="mt-3 space-y-1">
              {codes.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  発行済みのコードはありません。
                </p>
              ) : (
                codes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} />
                        <span className="truncate text-xs text-zinc-300">
                          {c.label || "（メモなし）"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">
                        {formatDateTime(c.createdAt)} 発行
                        {c.status === "active" &&
                          ` · ${formatDateTime(c.expiresAt)} まで`}
                        {c.status === "used" &&
                          c.usedAt &&
                          ` · ${formatDateTime(c.usedAt)} 使用`}
                      </div>
                    </div>
                    {c.status === "active" && (
                      <button
                        type="button"
                        onClick={() => revoke(c.id)}
                        className="shrink-0 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                      >
                        失効
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ===== ログイン履歴 ===== */}
          <section>
            <h3 className="text-sm font-semibold">ログイン履歴</h3>
            <p className="mt-1 text-xs text-zinc-400">直近 50 件（成功・失敗）。</p>
            <div className="mt-3 space-y-1">
              {loading ? (
                <p className="text-xs text-zinc-500">読み込み中…</p>
              ) : events.length === 0 ? (
                <p className="text-xs text-zinc-500">履歴はまだありません。</p>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs"
                  >
                    <span
                      className={`shrink-0 ${
                        ev.success ? "text-green-400" : "text-red-400"
                      }`}
                      aria-hidden
                    >
                      {ev.success ? "✓" : "✗"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-300">
                          {ev.success ? methodLabel(ev.method) : "失敗"}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-500">
                          {formatDateTime(ev.createdAt)}
                        </span>
                      </div>
                      <div
                        className="truncate text-[11px] text-zinc-500"
                        title={ev.userAgent ?? undefined}
                      >
                        {ev.ip ?? "IP不明"}
                        {ev.userAgent ? ` · ${ev.userAgent}` : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
