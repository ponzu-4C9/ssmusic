"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Cookie 反映後に proxy / レイアウトを再評価させるため完全リロード
        window.location.replace("/");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "ログインに失敗しました");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-7 shadow-xl"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">SS Music</h1>
          <p className="text-sm text-zinc-400">パスワードを入力してください</p>
        </div>

        <input
          type="password"
          inputMode="text"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-base outline-none focus:border-green-500"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "確認中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
