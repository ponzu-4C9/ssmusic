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
import type { Track } from "@/lib/types";

interface PlayerContextValue {
  tracks: Track[];
  loading: boolean;
  current: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  refresh: () => Promise<void>;
  addByUrl: (url: string) => Promise<{ ok: boolean; error?: string }>;
  removeTrack: (id: number) => Promise<void>;
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  /** id の曲の音量を変更。commit=true のとき DB へ保存する。 */
  setVolume: (id: number, volume: number, commit: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

const clampVol = (v: number) => Math.max(0, Math.min(100, v));

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 音量のドラッグ中/コミット待ちの値を保持し、ポーリングの上書きから守る
  const pendingVolumeRef = useRef<Map<number, number>>(new Map());

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const current = useMemo(
    () => tracks.find((t) => t.id === currentId) ?? null,
    [tracks, currentId],
  );

  // ---- データ取得 ----
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tracks", { cache: "no-store" });
      if (res.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { tracks: Track[] };
      // 音量の編集中(コミット待ち)はローカル値を優先し、ポーリングで巻き戻さない
      const pending = pendingVolumeRef.current;
      setTracks(
        pending.size === 0
          ? data.tracks
          : data.tracks.map((t) =>
              pending.has(t.id) ? { ...t, volume: pending.get(t.id)! } : t,
            ),
      );
    } catch {
      // ネットワークエラーは無視（次回ポーリングで回復）
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // queued / downloading がある間はポーリング
  const hasPending = useMemo(
    () => tracks.some((t) => t.status === "queued" || t.status === "downloading"),
    [tracks],
  );
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => void refresh(), 3000);
    return () => clearInterval(id);
  }, [hasPending, refresh]);

  // ---- 再生制御 ----
  const playTrack = useCallback(
    (track: Track) => {
      const audio = audioRef.current;
      if (!audio || track.status !== "ready") return;
      if (currentId !== track.id) {
        audio.src = `/api/stream/${track.id}`;
        audio.volume = clampVol(track.volume) / 100;
        audio.load();
        setCurrentId(track.id);
      }
      audio.play().catch(() => {});
    },
    [currentId],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentId) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, [currentId]);

  const seek = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = sec;
    setCurrentTime(sec);
  }, []);

  const setVolume = useCallback(
    (id: number, volume: number, commit: boolean) => {
      const v = clampVol(Math.round(volume));
      pendingVolumeRef.current.set(id, v);
      setTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, volume: v } : t)),
      );
      if (id === currentId && audioRef.current) {
        audioRef.current.volume = v / 100;
      }
      if (commit) {
        void fetch(`/api/tracks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ volume: v }),
        })
          .catch(() => {})
          .finally(() => {
            // コミット完了後にローカル優先を解除（以降はポーリング値でOK）
            pendingVolumeRef.current.delete(id);
          });
      }
    },
    [currentId],
  );

  const addByUrl = useCallback(
    async (url: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (res.status === 401) {
          window.location.replace("/login");
          return { ok: false, error: "未ログイン" };
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "失敗しました" };
        await refresh();
        return { ok: true };
      } catch {
        return { ok: false, error: "通信エラー" };
      }
    },
    [refresh],
  );

  const removeTrack = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/tracks/${id}`, { method: "DELETE" });
        if (res.status === 401) {
          window.location.replace("/login");
          return;
        }
      } catch {
        return;
      }
      if (id === currentId) {
        const audio = audioRef.current;
        if (audio) {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        }
        setCurrentId(null);
        setIsPlaying(false);
      }
      await refresh();
    },
    [currentId, refresh],
  );

  // ---- audio イベント（基本系は一度だけ束ねる） ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDur = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  // 次/前の曲（ready のみ対象）
  const readyTracks = useMemo(
    () => tracks.filter((t) => t.status === "ready"),
    [tracks],
  );
  const playNext = useCallback(() => {
    const idx = readyTracks.findIndex((t) => t.id === currentId);
    const next = idx >= 0 ? readyTracks[idx + 1] : readyTracks[0];
    if (next) playTrack(next);
  }, [readyTracks, currentId, playTrack]);
  const playPrev = useCallback(() => {
    const idx = readyTracks.findIndex((t) => t.id === currentId);
    const prev = idx > 0 ? readyTracks[idx - 1] : undefined;
    if (prev) playTrack(prev);
  }, [readyTracks, currentId, playTrack]);

  // ended → 次の曲。次が無ければ再生状態を解除（UI が再生中のまま固まるのを防ぐ）
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const idx = readyTracks.findIndex((t) => t.id === currentId);
      const nextTrack = idx >= 0 ? readyTracks[idx + 1] : readyTracks[0];
      if (nextTrack) playTrack(nextTrack);
      else setIsPlaying(false);
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [readyTracks, currentId, playTrack]);

  // ---- MediaSession（ロック画面/通知の操作） ----
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
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
    // play/pause は明示的に対応するアクションへ（togglePlay だと意味が反転しうる）
    ms.setActionHandler("play", () => {
      audioRef.current?.play().catch(() => {});
    });
    ms.setActionHandler("pause", () => {
      audioRef.current?.pause();
    });
    ms.setActionHandler("previoustrack", () => playPrev());
    ms.setActionHandler("nexttrack", () => playNext());
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
    };
  }, [current, playPrev, playNext]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  const value: PlayerContextValue = {
    tracks,
    loading,
    current,
    isPlaying,
    currentTime,
    duration,
    refresh,
    addByUrl,
    removeTrack,
    playTrack,
    togglePlay,
    next: playNext,
    prev: playPrev,
    seek,
    setVolume,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* 非表示の audio 本体 */}
      <audio ref={audioRef} preload="metadata" />
      <PlayerBar />
    </PlayerContext.Provider>
  );
}
