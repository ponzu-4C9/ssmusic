"use client";

import { useState } from "react";

import { useLibrary } from "@/components/LibraryProvider";
import { usePlayer } from "@/components/PlayerProvider";
import { formatTime } from "@/lib/format";
import type { Track } from "@/lib/types";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" />
    </svg>
  );
}

function StatusLabel({ track }: { track: Track }) {
  if (track.status === "downloading") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-400">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-400" />
        取り込み中…
      </span>
    );
  }
  if (track.status === "queued") {
    return <span className="text-xs text-zinc-400">待機中…</span>;
  }
  if (track.status === "error") {
    return (
      <span className="text-xs text-red-400">
        失敗：{track.error ?? "不明なエラー"}
      </span>
    );
  }
  return null;
}

function TrackRow({ track }: { track: Track }) {
  const {
    view,
    viewTracks,
    playlists,
    removeTrack,
    removeFromPlaylist,
    addToPlaylist,
  } = useLibrary();
  const { current, isPlaying, playQueue, togglePlay } = usePlayer();
  const [menuOpen, setMenuOpen] = useState(false);

  const isCurrent = current?.id === track.id;
  const ready = track.status === "ready";

  function onPlay() {
    if (!ready) return;
    if (isCurrent) togglePlay();
    else playQueue(viewTracks, track.id);
  }

  return (
    <li
      className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
        isCurrent ? "bg-zinc-800/70" : "hover:bg-zinc-900"
      }`}
    >
      <button
        type="button"
        disabled={!ready}
        onClick={onPlay}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
      >
        {track.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.thumbnailUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-zinc-800 text-zinc-500">
            ♪
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm ${
              isCurrent ? "font-semibold text-green-400" : "font-medium"
            }`}
          >
            {track.title}
          </div>
          {track.artist && (
            <div className="truncate text-xs text-zinc-400">{track.artist}</div>
          )}
          {!ready && (
            <div className="mt-0.5">
              <StatusLabel track={track} />
            </div>
          )}
        </div>
        {ready && (
          <span className="shrink-0 text-xs tabular-nums text-zinc-500">
            {isCurrent && isPlaying ? "▶ " : ""}
            {formatTime(track.durationSec)}
          </span>
        )}
      </button>

      {view.type === "library" ? (
        <>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="プレイリストに追加"
            >
              <PlusIcon />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute bottom-full right-0 z-50 mb-1 max-h-60 w-48 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                  {playlists.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-zinc-500">
                      プレイリストがありません
                    </div>
                  ) : (
                    playlists.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          void addToPlaylist(p.id, track.id);
                          setMenuOpen(false);
                        }}
                        className="block w-full truncate rounded px-3 py-2 text-left text-sm hover:bg-zinc-800"
                      >
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm(`「${track.title}」を削除しますか？`)) {
                void removeTrack(track.id);
              }
            }}
            className="shrink-0 rounded p-2 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
            aria-label="削除"
          >
            <TrashIcon />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (view.type === "playlist") {
              void removeFromPlaylist(view.id, track.id);
            }
          }}
          className="shrink-0 rounded p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="プレイリストから外す"
        >
          <CloseIcon />
        </button>
      )}
    </li>
  );
}

export function TrackList() {
  const { viewTracks, loading, view } = useLibrary();

  if (loading) {
    return <p className="py-12 text-center text-sm text-zinc-500">読み込み中…</p>;
  }

  if (viewTracks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        {view.type === "library"
          ? "まだ曲がありません。URL を追加するか MP3 をアップロードしてください。"
          : "このプレイリストは空です。「すべて」タブの ＋ から曲を追加できます。"}
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {viewTracks.map((track) => (
        <TrackRow key={track.id} track={track} />
      ))}
    </ul>
  );
}
