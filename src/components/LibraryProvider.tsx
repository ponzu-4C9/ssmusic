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

import type { Playlist, Track } from "@/lib/types";

export type View =
  | { type: "library" }
  | { type: "playlist"; id: number; name: string };

interface LibraryContextValue {
  tracks: Track[];
  playlists: Playlist[];
  view: View;
  viewTracks: Track[];
  loading: boolean;
  consoleTrackId: number | null;
  setView: (v: View) => void;
  refresh: () => Promise<void>;
  addByUrl: (url: string) => Promise<{ ok: boolean; error?: string }>;
  uploadFiles: (
    files: File[],
  ) => Promise<{ ok: boolean; added?: number; error?: string }>;
  removeTrack: (id: number) => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist | null>;
  deletePlaylist: (id: number) => Promise<void>;
  renamePlaylist: (id: number, name: string) => Promise<void>;
  addToPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  removeFromPlaylist: (playlistId: number, trackId: number) => Promise<void>;
  openConsole: (trackId: number) => void;
  closeConsole: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}

function onUnauthorized(res: Response): boolean {
  if (res.status === 401) {
    window.location.replace("/login");
    return true;
  }
  return false;
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [view, setViewState] = useState<View>({ type: "library" });
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [consoleTrackId, setConsoleTrackId] = useState<number | null>(null);

  const viewRef = useRef<View>(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const viewTracks = useMemo(
    () => (view.type === "library" ? tracks : playlistTracks),
    [view, tracks, playlistTracks],
  );

  // ---- フェッチ補助 ----
  const fetchTracks = useCallback(async (): Promise<Track[] | null> => {
    try {
      const res = await fetch("/api/tracks", { cache: "no-store" });
      if (onUnauthorized(res) || !res.ok) return null;
      const data = (await res.json()) as { tracks: Track[] };
      return data.tracks;
    } catch {
      return null;
    }
  }, []);

  const fetchPlaylistTracks = useCallback(
    async (id: number): Promise<Track[] | null> => {
      try {
        const res = await fetch(`/api/playlists/${id}`, { cache: "no-store" });
        if (onUnauthorized(res) || !res.ok) return null;
        const data = (await res.json()) as { tracks: Track[] };
        return data.tracks;
      } catch {
        return null;
      }
    },
    [],
  );

  const refreshPlaylists = useCallback(async () => {
    try {
      const res = await fetch("/api/playlists", { cache: "no-store" });
      if (onUnauthorized(res) || !res.ok) return;
      const data = (await res.json()) as { playlists: Playlist[] };
      setPlaylists(data.playlists);
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async () => {
    const t = await fetchTracks();
    if (t) setTracks(t);
    const v = viewRef.current;
    if (v.type === "playlist") {
      const reqId = v.id;
      const pt = await fetchPlaylistTracks(reqId);
      // await 中にビューが変わっていたら破棄（古い応答での上書き防止）
      if (
        pt &&
        viewRef.current.type === "playlist" &&
        viewRef.current.id === reqId
      ) {
        setPlaylistTracks(pt);
      }
    }
    setLoading(false);
  }, [fetchTracks, fetchPlaylistTracks]);

  useEffect(() => {
    void refresh();
    void refreshPlaylists();
  }, [refresh, refreshPlaylists]);

  // queued / downloading がある間はポーリング
  const hasPending = useMemo(
    () =>
      tracks.some((t) => t.status === "queued" || t.status === "downloading"),
    [tracks],
  );
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => void refresh(), 3000);
    return () => clearInterval(id);
  }, [hasPending, refresh]);

  // ---- ビュー切替 ----
  const setView = useCallback(
    (v: View) => {
      viewRef.current = v;
      setViewState(v);
      if (v.type === "playlist") {
        const reqId = v.id;
        setPlaylistTracks([]);
        void fetchPlaylistTracks(reqId).then((pt) => {
          if (
            pt &&
            viewRef.current.type === "playlist" &&
            viewRef.current.id === reqId
          ) {
            setPlaylistTracks(pt);
          }
        });
      }
    },
    [fetchPlaylistTracks],
  );

  const reloadCurrentPlaylist = useCallback(async () => {
    const v = viewRef.current;
    if (v.type === "playlist") {
      const reqId = v.id;
      const pt = await fetchPlaylistTracks(reqId);
      if (
        pt &&
        viewRef.current.type === "playlist" &&
        viewRef.current.id === reqId
      ) {
        setPlaylistTracks(pt);
      }
    }
  }, [fetchPlaylistTracks]);

  // ---- 取り込み ----
  const addByUrl = useCallback(
    async (url: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (onUnauthorized(res)) return { ok: false, error: "未ログイン" };
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

  const uploadFiles = useCallback(
    async (
      files: File[],
    ): Promise<{ ok: boolean; added?: number; error?: string }> => {
      if (files.length === 0) return { ok: false, error: "ファイルがありません" };
      try {
        const form = new FormData();
        for (const f of files) form.append("file", f);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (onUnauthorized(res)) return { ok: false, error: "未ログイン" };
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "失敗しました" };
        await refresh();
        return { ok: true, added: data.added ?? 0 };
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
        if (onUnauthorized(res)) return;
      } catch {
        return;
      }
      await refresh();
      await refreshPlaylists();
      await reloadCurrentPlaylist();
    },
    [refresh, refreshPlaylists, reloadCurrentPlaylist],
  );

  // ---- プレイリスト操作 ----
  const createPlaylist = useCallback(
    async (name: string): Promise<Playlist | null> => {
      try {
        const res = await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (onUnauthorized(res) || !res.ok) return null;
        const data = (await res.json()) as { playlist: Playlist };
        await refreshPlaylists();
        return data.playlist;
      } catch {
        return null;
      }
    },
    [refreshPlaylists],
  );

  const deletePlaylist = useCallback(
    async (id: number) => {
      try {
        await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      } catch {
        return;
      }
      if (viewRef.current.type === "playlist" && viewRef.current.id === id) {
        setView({ type: "library" });
      }
      await refreshPlaylists();
    },
    [refreshPlaylists, setView],
  );

  const renamePlaylist = useCallback(
    async (id: number, name: string) => {
      try {
        await fetch(`/api/playlists/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
      } catch {
        return;
      }
      if (viewRef.current.type === "playlist" && viewRef.current.id === id) {
        setViewState({ type: "playlist", id, name });
        viewRef.current = { type: "playlist", id, name };
      }
      await refreshPlaylists();
    },
    [refreshPlaylists],
  );

  const addToPlaylist = useCallback(
    async (playlistId: number, trackId: number) => {
      try {
        await fetch(`/api/playlists/${playlistId}/tracks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId }),
        });
      } catch {
        return;
      }
      await refreshPlaylists();
      await reloadCurrentPlaylist();
    },
    [refreshPlaylists, reloadCurrentPlaylist],
  );

  const removeFromPlaylist = useCallback(
    async (playlistId: number, trackId: number) => {
      try {
        await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
          method: "DELETE",
        });
      } catch {
        return;
      }
      await refreshPlaylists();
      await reloadCurrentPlaylist();
    },
    [refreshPlaylists, reloadCurrentPlaylist],
  );

  const openConsole = useCallback((trackId: number) => {
    setConsoleTrackId(trackId);
  }, []);
  const closeConsole = useCallback(() => setConsoleTrackId(null), []);

  const value: LibraryContextValue = {
    tracks,
    playlists,
    view,
    viewTracks,
    loading,
    consoleTrackId,
    setView,
    refresh,
    addByUrl,
    uploadFiles,
    removeTrack,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    openConsole,
    closeConsole,
  };

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}
