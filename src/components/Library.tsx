"use client";

import { AddTrackForm } from "@/components/AddTrackForm";
import { TrackList } from "@/components/TrackList";

export function Library() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-44 pt-6">
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
      <TrackList />
    </main>
  );
}
