"use client";

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

function StatusLabel({ track }: { track: Track }) {
  if (track.status === "downloading") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-400">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-400" />
        ダウンロード中…
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

export function TrackList() {
  const {
    tracks,
    loading,
    current,
    isPlaying,
    playTrack,
    togglePlay,
    removeTrack,
  } = usePlayer();

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">読み込み中…</p>
    );
  }

  if (tracks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        まだ曲がありません。上のフォームから YouTube の URL を追加してください。
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {tracks.map((track) => {
        const isCurrent = current?.id === track.id;
        const ready = track.status === "ready";
        return (
          <li
            key={track.id}
            className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
              isCurrent ? "bg-zinc-800/70" : "hover:bg-zinc-900"
            }`}
          >
            <button
              type="button"
              disabled={!ready}
              onClick={() => (isCurrent ? togglePlay() : playTrack(track))}
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
                <div className="h-12 w-12 shrink-0 rounded bg-zinc-800" />
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
                  <div className="truncate text-xs text-zinc-400">
                    {track.artist}
                  </div>
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
          </li>
        );
      })}
    </ul>
  );
}
