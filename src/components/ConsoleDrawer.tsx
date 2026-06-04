"use client";

import { useEffect, useRef, useState } from "react";

import { useLibrary } from "@/components/LibraryProvider";

// 完了(ready)後にこの時間だけ表示してから自動で閉じる
const AUTO_CLOSE_MS = 1800;

function statusText(status: string): string {
  if (status === "downloading") return "取り込み中…";
  if (status === "queued") return "待機中…";
  if (status === "ready") return "完了";
  if (status === "error") return "失敗";
  return status;
}

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
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

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
        // 終了状態になったらポーリング停止
        if (d.status === "ready" || d.status === "error") {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          // 成功時だけ少し見せてから自動的に閉じる。
          // 失敗時は理由を残すため閉じない（手動で閉じる）。
          if (d.status === "ready") {
            closeTimer = setTimeout(() => {
              if (alive) closeConsole();
            }, AUTO_CLOSE_MS);
          }
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
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [consoleTrackId, closeConsole]);

  // 末尾へ自動スクロール
  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [log]);

  if (consoleTrackId == null) return null;

  // 背景を覆わないフローティング窓（メインの操作は止めない）。
  // 完了で自動的に消える。右上に固定。
  return (
    <div className="fixed right-3 top-16 z-30 flex max-h-[55vh] w-[min(90vw,22rem)] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur sm:right-4">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {status === "downloading" && (
            <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-400" />
          )}
          <div className="min-w-0">
            <div className="text-xs font-semibold">取り込みログ</div>
            <div className="truncate text-[11px] text-zinc-500">
              {title}
              {status && ` · ${statusText(status)}`}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={closeConsole}
          className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
        >
          閉じる
        </button>
      </div>
      <pre
        ref={preRef}
        className="flex-1 overflow-auto whitespace-pre-wrap bg-black p-3 font-mono text-[11px] leading-relaxed text-green-300"
      >
        {log || "（ログはまだありません）"}
      </pre>
    </div>
  );
}
