"use client";

import { useState } from "react";

import { usePlayer } from "@/components/PlayerProvider";
import { formatTime } from "@/lib/format";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6zM20 6v12l-9-6z" />
    </svg>
  );
}
function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M16 6h2v12h-2zM4 6l9 6-9 6z" />
    </svg>
  );
}
function VolumeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-zinc-400"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z" />
    </svg>
  );
}

export function PlayerBar() {
  const {
    current,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
  } = usePlayer();

  // ドラッグ中はローカル値を表示し、再生中の timeupdate に引き戻されないようにする
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  if (!current) return null;

  const seekValue = scrubbing ? scrubValue : Math.min(currentTime, duration || 0);

  const onVolChange = (e: React.SyntheticEvent<HTMLInputElement>) =>
    setVolume(current.id, Number(e.currentTarget.value), false);
  const onVolCommit = (e: React.SyntheticEvent<HTMLInputElement>) =>
    setVolume(current.id, Number(e.currentTarget.value), true);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto w-full max-w-2xl">
        {/* シークバー */}
        <div className="flex items-center gap-2 px-3 pt-2 text-[11px] tabular-nums text-zinc-400">
          <span className="w-9 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={seekValue}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              setScrubValue(v);
              seek(v);
            }}
            onPointerDown={() => setScrubbing(true)}
            onPointerUp={() => setScrubbing(false)}
            onTouchStart={() => setScrubbing(true)}
            onTouchEnd={() => setScrubbing(false)}
            onKeyDown={() => setScrubbing(true)}
            onKeyUp={() => setScrubbing(false)}
            onBlur={() => setScrubbing(false)}
            className="h-1 flex-1 cursor-pointer"
            aria-label="再生位置"
          />
          <span className="w-9">{formatTime(duration)}</span>
        </div>

        {/* メイン操作行 */}
        <div className="flex items-center gap-3 px-3 py-2">
          {current.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.thumbnailUrl}
              alt=""
              className="h-11 w-11 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-11 w-11 shrink-0 rounded bg-zinc-700" />
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{current.title}</div>
            {current.artist && (
              <div className="truncate text-xs text-zinc-400">
                {current.artist}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={prev}
            className="hidden text-zinc-300 hover:text-white sm:block"
            aria-label="前の曲"
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-zinc-200"
            aria-label={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={next}
            className="hidden text-zinc-300 hover:text-white sm:block"
            aria-label="次の曲"
          >
            <NextIcon />
          </button>

          {/* 音量（曲ごと） */}
          <div className="flex items-center gap-1">
            <VolumeIcon />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={current.volume}
              onChange={onVolChange}
              onPointerUp={onVolCommit}
              onKeyUp={onVolCommit}
              onTouchEnd={onVolCommit}
              className="h-1 w-16 cursor-pointer sm:w-24"
              aria-label="この曲の音量"
            />
            <span className="w-7 text-right text-[11px] tabular-nums text-zinc-400">
              {current.volume}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
