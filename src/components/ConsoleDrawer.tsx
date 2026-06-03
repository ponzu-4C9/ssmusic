"use client";

import { useEffect, useRef, useState } from "react";

import { useLibrary } from "@/components/LibraryProvider";

export function ConsoleDrawer() {
  const { consoleTrackId, closeConsole } = useLibrary();
  const [log, setLog] = useState("");
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("");
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (consoleTrackId == null) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchLog = async () => {
      try {
        const res = await fetch(`/api/tracks/${consoleTrackId}/log`, {
          cache: "no-store",
        });
        if (!res.ok || !alive) return;
        const d = (await res.json()) as {
          status: string;
          title: string;
          log: string;
        };
        if (!alive) return;
        setLog(d.log ?? "");
        setStatus(d.status ?? "");
        setTitle(d.title ?? "");
        // 完了/失敗したらポーリング停止
        if ((d.status === "ready" || d.status === "error") && timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch {
        // ignore
      }
    };

    setLog("");
    setStatus("");
    setTitle("");
    void fetchLog();
    timer = setInterval(() => void fetchLog(), 1000);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [consoleTrackId]);

  // 末尾へ自動スクロール
  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [log]);

  if (consoleTrackId == null) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeConsole}
        aria-hidden
      />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">取り込みログ</div>
            <div className="truncate text-xs text-zinc-500">
              {title}
              {status && ` · ${status}`}
            </div>
          </div>
          <button
            type="button"
            onClick={closeConsole}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            閉じる
          </button>
        </div>
        <pre
          ref={preRef}
          className="flex-1 overflow-auto whitespace-pre-wrap bg-black p-4 font-mono text-xs leading-relaxed text-green-300"
        >
          {log || "（ログはまだありません）"}
        </pre>
      </div>
    </div>
  );
}
