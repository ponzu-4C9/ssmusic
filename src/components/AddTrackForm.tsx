"use client";

import { useState } from "react";

import { usePlayer } from "@/components/PlayerProvider";

export function AddTrackForm() {
  const { addByUrl } = usePlayer();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setMsg(null);
    const result = await addByUrl(trimmed);
    setSubmitting(false);
    if (result.ok) {
      setUrl("");
      setMsg({ type: "ok", text: "ダウンロードを開始しました" });
    } else {
      setMsg({ type: "error", text: result.error ?? "失敗しました" });
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-6">
      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube の URL を貼り付け"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-green-500"
        />
        <button
          type="submit"
          disabled={submitting || url.trim().length === 0}
          className="shrink-0 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "追加中…" : "追加"}
        </button>
      </div>
      {msg && (
        <p
          className={`mt-2 text-xs ${
            msg.type === "ok" ? "text-green-400" : "text-red-400"
          }`}
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}
