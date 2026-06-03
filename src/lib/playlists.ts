// プレイリストのデータアクセス層。

import { ensureSchema, query } from "@/lib/db";
import { mapTrackRow, type TrackRow } from "@/lib/tracks";
import type { Playlist, Track } from "@/lib/types";

interface PlaylistRow {
  id: string;
  name: string;
  created_at: Date;
  track_count: number;
}

function mapPlaylist(r: PlaylistRow): Playlist {
  return {
    id: Number(r.id),
    name: r.name,
    trackCount: Number(r.track_count),
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  };
}

// JOIN 用にプレフィックス付きで列を明示（log は一覧に含めない）。
const T_COLUMNS =
  "t.id, t.title, t.artist, t.source_url, t.source_id, t.file_path, t.duration_sec, t.volume, t.thumbnail_url, t.status, t.error, t.created_at";

export async function listPlaylists(): Promise<Playlist[]> {
  await ensureSchema();
  const { rows } = await query<PlaylistRow>(
    `SELECT p.id, p.name, p.created_at, COUNT(pt.track_id)::int AS track_count
     FROM playlists p
     LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC, p.id DESC`,
  );
  return rows.map(mapPlaylist);
}

export async function getPlaylist(id: number): Promise<Playlist | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  await ensureSchema();
  const { rows } = await query<PlaylistRow>(
    `SELECT p.id, p.name, p.created_at, COUNT(pt.track_id)::int AS track_count
     FROM playlists p
     LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [id],
  );
  return rows[0] ? mapPlaylist(rows[0]) : null;
}

export async function createPlaylist(name: string): Promise<Playlist> {
  await ensureSchema();
  const { rows } = await query<{ id: string; name: string; created_at: Date }>(
    `INSERT INTO playlists (name) VALUES ($1) RETURNING id, name, created_at`,
    [name.trim() || "新しいプレイリスト"],
  );
  return {
    id: Number(rows[0].id),
    name: rows[0].name,
    trackCount: 0,
    createdAt:
      rows[0].created_at instanceof Date
        ? rows[0].created_at.toISOString()
        : String(rows[0].created_at),
  };
}

export async function renamePlaylist(
  id: number,
  name: string,
): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  await ensureSchema();
  const res = await query("UPDATE playlists SET name = $2 WHERE id = $1", [
    id,
    name.trim() || "新しいプレイリスト",
  ]);
  return (res.rowCount ?? 0) > 0;
}

export async function deletePlaylist(id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  await ensureSchema();
  const res = await query("DELETE FROM playlists WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function getPlaylistTracks(id: number): Promise<Track[]> {
  if (!Number.isInteger(id) || id <= 0) return [];
  await ensureSchema();
  const { rows } = await query<TrackRow>(
    `SELECT ${T_COLUMNS}
     FROM playlist_tracks pt
     JOIN tracks t ON t.id = pt.track_id
     WHERE pt.playlist_id = $1
     ORDER BY pt.position, pt.added_at, t.id`,
    [id],
  );
  return rows.map(mapTrackRow);
}

export async function addTrackToPlaylist(
  playlistId: number,
  trackId: number,
): Promise<void> {
  if (!Number.isInteger(playlistId) || !Number.isInteger(trackId)) return;
  await ensureSchema();
  await query(
    `INSERT INTO playlist_tracks (playlist_id, track_id, position)
     VALUES ($1, $2,
       COALESCE((SELECT MAX(position) + 1 FROM playlist_tracks WHERE playlist_id = $1), 0))
     ON CONFLICT (playlist_id, track_id) DO NOTHING`,
    [playlistId, trackId],
  );
}

export async function removeTrackFromPlaylist(
  playlistId: number,
  trackId: number,
): Promise<void> {
  if (!Number.isInteger(playlistId) || !Number.isInteger(trackId)) return;
  await ensureSchema();
  await query(
    "DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2",
    [playlistId, trackId],
  );
}
