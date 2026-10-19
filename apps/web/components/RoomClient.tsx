"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { useGuestName, useStoredName } from "@/lib/name";

const CHAT_ERRORS: Record<string, string> = {
  RATE_LIMITED: "You're sending messages too fast — wait a moment.",
  BAD_REQUEST: "Message must be 1-500 characters.",
  NOT_JOINED: "Not connected to the room yet.",
};

export default function RoomClient({ roomId }: { roomId: string }) {
  const stored = useStoredName();
  const guest = useGuestName();
  const name = (stored ?? guest) || null;
  const { status, members, room, error, errorCode, chat, sendChat, clientId } =
    useRoomSocket(roomId, name);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState("");
  const chatListRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

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
        <ul
          ref={chatListRef}
          className="h-48 flex-1 overflow-y-auto px-4 py-2 text-sm"
        >
          {chat.map((m) => (
            <li key={m.id} className="py-0.5 text-zinc-800 dark:text-zinc-200">
              <span
                className={
                  m.clientId === clientId
                    ? "font-semibold text-zinc-950 dark:text-white"
                    : "font-medium text-zinc-600 dark:text-zinc-400"
                }
              >
                {m.name}
              </span>
              <span className="text-zinc-400">
                {" "}
                {new Date(m.at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              : {m.text}
            </li>
          ))}
          {chat.length === 0 && (
            <li className="py-1 text-zinc-400">No messages yet — say hi.</li>
          )}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (text) {
              sendChat(text);
              setDraft("");
            }
          }}
          className="flex gap-2 border-t border-zinc-200 p-2 dark:border-zinc-800"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder="Type a message..."
            className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Send
          </button>
        </form>
        {errorCode && (
          <p className="px-4 pb-2 text-xs text-red-600">
            {CHAT_ERRORS[errorCode] ?? "Something went wrong."}
          </p>
        )}
      </section>
    </div>
  );
}
