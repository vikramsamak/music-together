"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api";
import { setStoredName, useStoredName } from "@/lib/name";

export default function Home() {
  const router = useRouter();
  const stored = useStoredName();
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const name = nameOverride ?? stored ?? "";
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChangeName = (value: string) => {
    setNameOverride(value);
    setStoredName(value);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const roomId = await createRoom();
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create a room. Is the API running on :3001?",
      );
      setBusy(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(code)) {
      router.push(`/room/${code}`);
    } else {
      setError("Room codes are 6 characters.");
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-sm flex flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          music-together
        </h1>

        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your name
          <input
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Your name"
            maxLength={24}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <span className="text-xs">
            Saved for next time. Leave empty for a random guest name.
          </span>
        </label>

        <button
          onClick={handleCreate}
          disabled={busy}
          className="rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Creating..." : "Create a room"}
        </button>

        <form onSubmit={handleJoin} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code"
              maxLength={6}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono uppercase text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="rounded border border-zinc-300 px-4 py-2 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Join
            </button>
          </div>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </main>
    </div>
  );
}
