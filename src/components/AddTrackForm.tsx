"use client";

import { useRef, useState } from "react";

import { useLibrary } from "@/components/LibraryProvider";

export function AddTrackForm() {
  const { addByUrl, uploadFiles } = useLibrary();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

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
      setMsg({ type: "ok", text: "取り込みを開始しました" });
    } else {
      setMsg({ type: "error", text: result.error ?? "失敗しました" });
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setMsg(null);
    const result = await uploadFiles(files);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (result.ok) {
      setMsg({ type: "ok", text: `${result.added ?? 0} 件アップロードしました` });
    } else {
      setMsg({ type: "error", text: result.error ?? "失敗しました" });
    }
  }

  return (
    <div className="mb-5">
      <form onSubmit={onSubmit} className="flex gap-2">
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
      </form>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {uploading ? "アップロード中…" : "＋ MP3 をアップロード"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,.mp3"
          multiple
          className="hidden"
          onChange={onFiles}
        />
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
    </div>
  );
}
