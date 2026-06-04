"use client";

import { useState } from "react";

import { usePlayer, usePlayerProgress } from "@/components/PlayerProvider";
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
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-zinc-400" fill="currentColor" aria-hidden>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z" />
    </svg>
  );
}
function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M17 3l4 4-4 4v-3h-2.5l-2.3 2.6-1.3-1.5L13.4 6H17V3zM3 6h3.6l8.8 9.9.6.1H17v-3l4 4-4 4v-3h-2.6l-.7-.2L4.9 9H3V6zm0 9h3l1.6-1.8 1.3 1.5L6.6 18H3v-3z" />
    </svg>
  );
}
function RepeatIcon({ one }: { one?: boolean }) {
  return (
    <span className="relative inline-flex">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
      </svg>
      {one && (
        <span className="absolute -right-1 -top-1 rounded bg-green-500 px-1 text-[9px] font-bold leading-tight text-black">
          1
        </span>
      )}
    </span>
  );
}

export function PlayerBar() {
  const {
    current,
    isPlaying,
    shuffle,
    repeat,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();
  const { currentTime, duration } = usePlayerProgress();

  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  if (!current) return null;

  const seekValue = scrubbing ? scrubValue : Math.min(currentTime, duration || 0);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto w-full max-w-2xl px-3 pt-2">
        {/* 縦音量スライダー（バー右端から立ち上がる = テトリスのL字） */}
        <div className="absolute bottom-full right-2 flex flex-col items-center gap-1 rounded-t-xl border border-b-0 border-zinc-800 bg-zinc-900/95 px-2 pb-1 pt-2 backdrop-blur">
          <VolumeIcon />
          <div className="relative flex h-24 w-8 items-center justify-center">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={current.volume}
              onChange={(e) =>
                setVolume(current.id, Number(e.currentTarget.value), false)
              }
              onPointerUp={(e) =>
                setVolume(current.id, Number(e.currentTarget.value), true)
              }
              onKeyUp={(e) =>
                setVolume(current.id, Number(e.currentTarget.value), true)
              }
              onTouchEnd={(e) =>
                setVolume(current.id, Number(e.currentTarget.value), true)
              }
              className="h-6 w-24 cursor-pointer"
              style={{ transform: "rotate(-90deg)" }}
              aria-label="この曲の音量"
            />
          </div>
          <span className="text-[11px] tabular-nums text-zinc-400">
            {current.volume}
          </span>
        </div>

        {/* シークバー */}
        <div className="flex items-center gap-2 text-[11px] tabular-nums text-zinc-400">
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

        {/* 情報 */}
        <div className="mt-1 flex items-center gap-3">
          {current.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.thumbnailUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded bg-zinc-700" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{current.title}</div>
            {current.artist && (
              <div className="truncate text-xs text-zinc-400">
                {current.artist}
              </div>
            )}
          </div>
        </div>

        {/* 再生コントロール */}
        <div className="mt-1 flex items-center justify-center gap-5 py-1">
          <button
            type="button"
            onClick={toggleShuffle}
            className={shuffle ? "text-green-400" : "text-zinc-500 hover:text-zinc-300"}
            aria-label="シャッフル"
            aria-pressed={shuffle}
          >
            <ShuffleIcon />
          </button>
          <button
            type="button"
            onClick={prev}
            className="text-zinc-200 hover:text-white"
            aria-label="前の曲"
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-zinc-200"
            aria-label={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={next}
            className="text-zinc-200 hover:text-white"
            aria-label="次の曲"
          >
            <NextIcon />
          </button>
          <button
            type="button"
            onClick={cycleRepeat}
            className={repeat === "off" ? "text-zinc-500 hover:text-zinc-300" : "text-green-400"}
            aria-label={`リピート: ${repeat === "off" ? "なし" : repeat === "all" ? "全体" : "1曲"}`}
          >
            <RepeatIcon one={repeat === "one"} />
          </button>
        </div>
      </div>
    </div>
  );
}
