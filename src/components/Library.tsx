"use client";

import { AddTrackForm } from "@/components/AddTrackForm";
import { ConsoleDrawer } from "@/components/ConsoleDrawer";
import { useLibrary } from "@/components/LibraryProvider";
import { usePlayer } from "@/components/PlayerProvider";
import { PlaylistTabs } from "@/components/PlaylistTabs";
import { TrackList } from "@/components/TrackList";

export function Library() {
  const { view, viewTracks, renamePlaylist, deletePlaylist } = useLibrary();
  const { playQueue } = usePlayer();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/login");
  }

  function playAll() {
    const ready = viewTracks.filter((t) => t.status === "ready" && t.filePath);
    if (ready.length > 0) playQueue(viewTracks, ready[0].id);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-56 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">SS Music</h1>
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
    </main>
  );
}
