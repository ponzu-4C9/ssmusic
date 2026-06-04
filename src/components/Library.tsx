"use client";

import { useState } from "react";

import { AccountPanel } from "@/components/AccountPanel";
import { AddTrackForm } from "@/components/AddTrackForm";
import { ConsoleDrawer } from "@/components/ConsoleDrawer";
import { useLibrary } from "@/components/LibraryProvider";
import { usePlayer } from "@/components/PlayerProvider";
import { PlaylistTabs } from "@/components/PlaylistTabs";
import { TrackList } from "@/components/TrackList";

export function Library() {
  const { view, viewTracks, renamePlaylist, deletePlaylist } = useLibrary();
  const { playQueue } = usePlayer();
  const [accountOpen, setAccountOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/login");
  }

  function playAll() {
    const ready = viewTracks.filter((t) => t.status === "ready" && t.filePath);
    if (ready.length > 0) playQueue(viewTracks, ready[0].id);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-72 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="group flex items-center gap-1.5 rounded-md text-xl font-bold tracking-tight outline-none hover:text-green-400 focus-visible:ring-2 focus-visible:ring-green-500"
          aria-label="アカウント（ワンタイムパスワード・ログイン履歴）"
        >
          SS Music
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-green-400"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-6 1.8-6 4v1h12v-1c0-2.2-2.7-4-6-4z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={logout}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          ログアウト
        </button>
      </header>

      <AddTrackForm />
      <PlaylistTabs />

      {view.type === "playlist" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={playAll}
            className="rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-500"
          >
            ▶ 再生
          </button>
          <button
            type="button"
            onClick={async () => {
              if (view.type !== "playlist") return;
              const name = window.prompt("新しい名前", view.name);
              if (name && name.trim()) await renamePlaylist(view.id, name.trim());
            }}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            名前変更
          </button>
          <button
            type="button"
            onClick={() => {
              if (view.type !== "playlist") return;
              if (confirm(`プレイリスト「${view.name}」を削除しますか？`)) {
                void deletePlaylist(view.id);
              }
            }}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-red-400"
          >
            削除
          </button>
        </div>
      )}

      <TrackList />
      <ConsoleDrawer />
      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
    </main>
  );
}
