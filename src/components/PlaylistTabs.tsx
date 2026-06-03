"use client";

import { useLibrary } from "@/components/LibraryProvider";

export function PlaylistTabs() {
  const { playlists, view, setView, createPlaylist } = useLibrary();

  async function onCreate() {
    const name = window.prompt("プレイリスト名を入力");
    if (!name || !name.trim()) return;
    const pl = await createPlaylist(name.trim());
    if (pl) setView({ type: "playlist", id: pl.id, name: pl.name });
  }

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
      active
        ? "bg-green-600 text-white"
        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
    }`;

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => setView({ type: "library" })}
        className={chip(view.type === "library")}
      >
        すべて
      </button>
      {playlists.map((p) => (
        <button
          type="button"
          key={p.id}
          onClick={() => setView({ type: "playlist", id: p.id, name: p.name })}
          className={chip(view.type === "playlist" && view.id === p.id)}
        >
          {p.name}
          <span className="ml-1.5 opacity-60">{p.trackCount}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onCreate}
        className="shrink-0 whitespace-nowrap rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
      >
        ＋新規
      </button>
    </div>
  );
}
