"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { PlayerBar } from "@/components/PlayerBar";
import type { RepeatMode, Track } from "@/lib/types";

interface PlayerContextValue {
  current: Track | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** tracks を再生キューにして startId から再生する。 */
  playQueue: (tracks: Track[], startId: number) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (id: number, volume: number, commit: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

// 再生位置は毎秒更新されるため、別 context に分離して
// 曲リスト(TrackRow)が timeupdate ごとに再描画されるのを防ぐ。
interface PlayerProgressValue {
  currentTime: number;
  duration: number;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);
const PlayerProgressContext = createContext<PlayerProgressValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function usePlayerProgress(): PlayerProgressValue {
  const ctx = useContext(PlayerProgressContext);
  if (!ctx)
    throw new Error("usePlayerProgress must be used within PlayerProvider");
  return ctx;
}

const clampVol = (v: number) => Math.max(0, Math.min(100, v));

function shuffleIds(ids: number[], firstId: number | null): number[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (firstId != null) {
    const idx = arr.indexOf(firstId);
    if (idx > 0) {
      arr.splice(idx, 1);
      arr.unshift(firstId);
    }
  }
  return arr;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [queue, setQueue] = useState<Track[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");

  // イベントハンドラから最新値を読むための ref
  const queueRef = useRef<Track[]>([]);
  const orderRef = useRef<number[]>([]); // 再生順（id の配列）
  const currentIdRef = useRef<number | null>(null);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>("off");
  const errorStreakRef = useRef(0); // 連続ロード失敗カウンタ（無限スキップ防止）

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const current = useMemo(
    () => queue.find((t) => t.id === currentId) ?? null,
    [queue, currentId],
  );

  const loadAndPlay = useCallback((id: number) => {
    const audio = audioRef.current;
    const track = queueRef.current.find((t) => t.id === id);
    if (!audio || !track) return;
    audio.src = `/api/stream/${id}`;
    audio.volume = clampVol(track.volume) / 100;
    audio.load();
    currentIdRef.current = id;
    setCurrentId(id);
    // 新しい曲の情報を即時反映（メタデータ到着までの表示ズレを防ぐ）
    setCurrentTime(0);
    setDuration(track.durationSec ?? 0);
    audio.play().catch(() => {});
  }, []);

  const playQueue = useCallback(
    (tracks: Track[], startId: number) => {
      const ready = tracks.filter((t) => t.status === "ready" && t.filePath);
      if (ready.length === 0) return;
      if (!ready.some((t) => t.id === startId)) return;
      queueRef.current = ready;
      setQueue(ready);
      const ids = ready.map((t) => t.id);
      orderRef.current = shuffleRef.current ? shuffleIds(ids, startId) : ids;
      errorStreakRef.current = 0;
      loadAndPlay(startId);
    },
    [loadAndPlay],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || currentIdRef.current == null) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const seek = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = sec;
    setCurrentTime(sec);
  }, []);

  const next = useCallback(() => {
    const order = orderRef.current;
    if (order.length === 0) return;
    const idx = order.indexOf(currentIdRef.current ?? -1);
    let n = idx + 1;
    if (n >= order.length) {
      if (repeatRef.current === "all") n = 0;
      else return;
    }
    errorStreakRef.current = 0;
    loadAndPlay(order[n]);
  }, [loadAndPlay]);

  const prev = useCallback(() => {
    const order = orderRef.current;
    if (order.length === 0) return;
    const idx = order.indexOf(currentIdRef.current ?? -1);
    // 3秒以上再生していたら頭出し、それ以外は前の曲へ
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      seek(0);
      return;
    }
    let p = idx - 1;
    if (p < 0) {
      if (repeatRef.current === "all") p = order.length - 1;
      else {
        seek(0);
        return;
      }
    }
    errorStreakRef.current = 0;
    loadAndPlay(order[p]);
  }, [loadAndPlay, seek]);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const nextShuffle = !prev;
      shuffleRef.current = nextShuffle;
      const ids = queueRef.current.map((t) => t.id);
      orderRef.current = nextShuffle
        ? shuffleIds(ids, currentIdRef.current)
        : ids;
      return nextShuffle;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => {
      const order: RepeatMode[] = ["off", "all", "one"];
      const nextRepeat = order[(order.indexOf(prev) + 1) % order.length];
      repeatRef.current = nextRepeat;
      return nextRepeat;
    });
  }, []);

  const setVolume = useCallback(
    (id: number, volume: number, commit: boolean) => {
      const v = clampVol(Math.round(volume));
      setQueue((prev) =>
        prev.map((t) => (t.id === id ? { ...t, volume: v } : t)),
      );
      if (id === currentIdRef.current && audioRef.current) {
        audioRef.current.volume = v / 100;
      }
      if (commit) {
        void fetch(`/api/tracks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ volume: v }),
        }).catch(() => {});
      }
    },
    [],
  );

  // ---- audio イベント（refs を使うので一度だけ束ねる） ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onDur = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => {
      setIsPlaying(true);
      errorStreakRef.current = 0; // 正常再生で失敗カウンタをリセット
    };
    const onPause = () => setIsPlaying(false);

    const advanceAfterEnd = () => {
      const order = orderRef.current;
      const idx = order.indexOf(currentIdRef.current ?? -1);
      let n = idx + 1;
      if (n >= order.length) {
        if (repeatRef.current === "all") n = 0;
        else {
          setIsPlaying(false);
          return;
        }
      }
      loadAndPlay(order[n]);
    };

    const onEnded = () => {
      if (repeatRef.current === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      advanceAfterEnd();
    };

    // 読み込み失敗（ファイル欠落/404/ネットワーク）でキューを止めない
    const onError = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      if (repeatRef.current === "one") return; // 同じ壊れた曲の再試行ループを防ぐ
      const order = orderRef.current;
      if (order.length === 0) return;
      errorStreakRef.current += 1;
      if (errorStreakRef.current >= order.length) {
        // 全曲が壊れている等。スキップを打ち切る。
        errorStreakRef.current = 0;
        return;
      }
      const idx = order.indexOf(currentIdRef.current ?? -1);
      let n = idx + 1;
      if (n >= order.length) {
        if (repeatRef.current === "all") n = 0;
        else {
          errorStreakRef.current = 0;
          return;
        }
      }
      loadAndPlay(order[n]);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [loadAndPlay]);

  // ---- MediaSession ----
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    const ms = navigator.mediaSession;
    if (!current) {
      ms.metadata = null;
      return;
    }
    ms.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist ?? "",
      artwork: current.thumbnailUrl
        ? [{ src: current.thumbnailUrl, sizes: "512x512", type: "image/jpeg" }]
        : undefined,
    });
  }, [current]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => audioRef.current?.play().catch(() => {}));
    ms.setActionHandler("pause", () => audioRef.current?.pause());
    ms.setActionHandler("previoustrack", () => prev());
    ms.setActionHandler("nexttrack", () => next());
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
    };
  }, [next, prev]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      isPlaying,
      shuffle,
      repeat,
      playQueue,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
    }),
    [
      current,
      isPlaying,
      shuffle,
      repeat,
      playQueue,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
    ],
  );

  const progressValue = useMemo<PlayerProgressValue>(
    () => ({ currentTime, duration }),
    [currentTime, duration],
  );

  return (
    <PlayerContext.Provider value={value}>
      <PlayerProgressContext.Provider value={progressValue}>
        {children}
        <audio ref={audioRef} preload="metadata" />
        <PlayerBar />
      </PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
}
