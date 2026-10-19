"use client";

import Link from "next/link";
import { useState } from "react";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { useGuestName, useStoredName } from "@/lib/name";

export default function RoomClient({ roomId }: { roomId: string }) {
  const stored = useStoredName();
  const guest = useGuestName();
  const name = (stored ?? guest) || null;
  const { status, members, room, error, clientId } = useRoomSocket(roomId, name);
  const [copied, setCopied] = useState(false);

  if (!name) {
    return <div className="p-8 text-zinc-500">Loading...</div>;
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex items-center gap-4">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          &larr; Home
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Room{" "}
          <button
            onClick={copyCode}
            className="font-mono rounded bg-zinc-100 px-2 py-0.5 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            title="Copy room code"
          >
            {roomId}
          </button>
          {copied && <span className="ml-2 text-xs text-zinc-500">copied</span>}
        </h1>
        <span className="ml-auto text-sm text-zinc-500">
          {status === "joined" && "connected"}
          {status === "connecting" && "connecting..."}
          {status === "disconnected" && "reconnecting..."}
          {status === "error" && "error"}
        </span>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-3">
        <section className="flex flex-col rounded border border-zinc-200 dark:border-zinc-800">
          <h2 className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            Members ({members.length})
          </h2>
          <ul className="flex-1 overflow-y-auto p-2">
            {members.map((m) => (
              <li key={m.clientId} className="px-2 py-1 text-sm text-zinc-800 dark:text-zinc-200">
                {m.name}
                {m.clientId === clientId && (
                  <span className="ml-1 text-xs text-zinc-400">(you)</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col rounded border border-zinc-200 md:col-span-2 dark:border-zinc-800">
          <h2 className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            Player
          </h2>
          <div className="flex flex-1 items-center justify-center p-4 text-sm text-zinc-400">
            Player comes in Phase 3 · created {room ? "room ok" : "..."}
          </div>
        </section>
      </div>

      <section className="flex flex-col rounded border border-zinc-200 dark:border-zinc-800">
        <h2 className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          Chat
        </h2>
        <div className="flex h-32 items-center justify-center text-sm text-zinc-400">
          Chat comes in Phase 2
        </div>
      </section>
    </div>
  );
}
