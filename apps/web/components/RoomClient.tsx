"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ShareRoom from "@/components/ShareRoom";
import YouTubePlayer, { type PlayerHandle } from "@/components/YouTubePlayer";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { useWakeLock } from "@/hooks/useWakeLock";
import { searchVideos, type SearchResult } from "@/lib/api";
import { useGuestName, useStoredName } from "@/lib/name";
import { formatTime, serverPosition } from "@/lib/playback";

const ERRORS: Record<string, string> = {
  RATE_LIMITED: "You're sending messages too fast — wait a moment.",
  BAD_REQUEST: "That request wasn't valid.",
  NOT_JOINED: "Not connected to the room yet.",
  BAD_VIDEO: "That doesn't look like a YouTube link.",
  QUEUE_FULL: "The queue is full (50 tracks).",
  INTERNAL: "Server hiccup — try again.",
};

const DRIFT_TOLERANCE_S = 2;
// Only report a genuine end of the video: a premature ENDED (past-end seek,
// clock skew, another client running fast) would end the track early or pause
// the whole room.
const ENDED_GUARD_S = 2;

export default function RoomClient({ roomId }: { roomId: string }) {
  const stored = useStoredName();
  const guest = useGuestName();
  const name = (stored ?? guest) || null;
  const {
    status,
    members,
    error,
    errorCode,
    chat,
    queue,
    playback,
    playbackEvent,
    playbackRef,
    clientId,
    sendChat,
    addTrack,
    removeTrack,
    play,
    pause,
    seek,
    next,
    prev,
    reportEnded,
    serverNow,
  } = useRoomSocket(roomId, name);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [activePanel, setActivePanel] = useState<"chat" | "members">("chat");
  const chatListRef = useRef<HTMLUListElement>(null);
  const playerRef = useRef<PlayerHandle | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const serverNowRef = useRef(serverNow);
  const playing = playback?.playing ?? false;
  const currentTrack = queue.find((t) => t.id === playback?.currentTrackId);

  useMediaSession({
    track: currentTrack ?? null,
    playback,
    onPlay: play,
    onPause: pause,
    onNext: next,
    onPrev: prev,
    onSeek: (position) => {
      seek(position);
      playerRef.current?.seekTo(position);
    },
  });
  useWakeLock(playing && status === "joined");

  useEffect(() => {
    serverNowRef.current = serverNow;
  });

  useEffect(() => {
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  useEffect(() => {
    if (!playbackEvent || !playerReady) return;
    const player = playerRef.current;
    if (!player) return;
    const state = playbackEvent.state;

    if (!state.currentVideoId) {
      loadedVideoIdRef.current = null;
      player.pause();
      return;
    }

    const rawTarget = serverPosition(state, serverNowRef.current());

    if (loadedVideoIdRef.current !== state.currentVideoId) {
      loadedVideoIdRef.current = state.currentVideoId;
      // Clamp start position: serverPosition() can overshoot the video duration
      // after a reconnect (stale updatedAt). Passing a past-end value to
      // loadVideoById triggers an immediate ENDED before the video renders.
      const clampedStart = Math.max(0, rawTarget);
      if (state.playing) player.load(state.currentVideoId, clampedStart);
      else player.cue(state.currentVideoId, clampedStart);
      return;
    }

    // Clamp to this video's duration so a seek can never land past the end
    // (a past-end seek fires ENDED and would stop/advance the room).
    const duration = player.getDuration();
    const target = duration > 0 ? Math.min(rawTarget, duration) : rawTarget;

    if (state.playing) {
      // A premature ENDED that we deliberately did not report would otherwise
      // sit at the end forever — pull it back to the room position.
      if (player.isEnded()) {
        if (duration > 0) player.seekTo(Math.max(0, Math.min(target, duration - 1)));
        player.play();
        return;
      }
      // Measure drift only while playback is actually running: during startup
      // getCurrentTime() reads 0 while target keeps advancing, and hard-seeking
      // into an unbuffered region is what froze the video seconds after play.
      if (
        player.isPlaying() &&
        !player.isBuffering() &&
        duration > 0 &&
        Math.abs(player.getCurrentTime() - target) > DRIFT_TOLERANCE_S
      ) {
        player.seekTo(target);
        return;
      }
      if (!player.isPlaying() && !player.isBuffering()) player.play();
    } else if (player.isPlaying()) {
      player.pause();
    } else if (
      !player.isEnded() &&
      duration > 0 &&
      Math.abs(player.getCurrentTime() - target) > DRIFT_TOLERANCE_S
    ) {
      player.seekTo(target);
    }
  }, [playbackEvent, playerReady]);

  useEffect(() => {
    if (status !== "joined" || !playerReady) return;
    let overToleranceTicks = 0;
    const timer = setInterval(() => {
      const player = playerRef.current;
      const state = playbackRef.current;
      if (!player || !state?.currentVideoId) return;
      if (loadedVideoIdRef.current !== state.currentVideoId) return;

      const rawTarget = serverPosition(state, serverNowRef.current());

      if (!state.playing) {
        overToleranceTicks = 0;
        if (player.isPlaying()) player.pause();
        return;
      }

      const duration = player.getDuration();
      const target = duration > 0 ? Math.min(rawTarget, duration) : rawTarget;

      if (player.isEnded()) {
        overToleranceTicks = 0;
        if (duration > 0) player.seekTo(Math.max(0, Math.min(target, duration - 1)));
        player.play();
        return;
      }

      if (!player.isPlaying()) {
        // Still starting or buffering: only resume if genuinely paused.
        // Calling play() while in state BUFFERING (3) resets the buffer cycle
        // and is the root cause of the video appearing to auto-pause/stutter.
        overToleranceTicks = 0;
        if (!player.isBuffering()) player.play();
        return;
      }

      // Settled playback: hard-seek only when drift stays over the tolerance
      // for two consecutive checks, so transient spikes (startup lag, an ad)
      // don't cause a seek storm.
      if (
        duration > 0 &&
        Math.abs(player.getCurrentTime() - target) > DRIFT_TOLERANCE_S
      ) {
        overToleranceTicks += 1;
        if (overToleranceTicks >= 2) {
          player.seekTo(target);
          overToleranceTicks = 0;
        }
      } else {
        overToleranceTicks = 0;
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [status, playbackRef, playerReady]);

  useEffect(() => {
    if (status !== "joined" || !playerReady) return;
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setNowSec(player.getCurrentTime());
      setDuration(player.getDuration());
    }, 1000);
    return () => clearInterval(timer);
  }, [status, playerReady]);

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

  const commitSeek = (position: number) => {
    playerRef.current?.seekTo(position);
    seek(position);
  };

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchVideos(q));
    } catch {
      setResults([]);
      setSearchError("Search unavailable — paste a link instead.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center gap-3 sm:gap-4">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          &larr; Home
        </Link>
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl dark:text-zinc-100">
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
        <ShareRoom roomId={roomId} />
        <span className="ml-auto text-xs text-zinc-500 sm:text-sm">
          {status === "joined" && "connected"}
          {status === "connecting" && "connecting..."}
          {status === "disconnected" && "reconnecting..."}
          {status === "error" && "error"}
        </span>
        <button
          onClick={() => setActivePanel(activePanel === "members" ? "chat" : "members")}
          className="inline-flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 lg:hidden"
        >
          {activePanel === "members" ? "Chat" : `People (${members.length})`}
        </button>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid flex-1 min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
        <main className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col rounded border border-zinc-200 dark:border-zinc-800">
            <h2 className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
              Player
            </h2>
            <YouTubePlayer
              ref={playerRef}
              onReady={() => setPlayerReady(true)}
              onEnded={() => {
                const state = playbackRef.current;
                if (!state?.currentVideoId) return;
                const player = playerRef.current;
                if (!player) return;
                const duration = player.getDuration();
                if (
                  duration > 0 &&
                  player.getCurrentTime() <= duration - ENDED_GUARD_S
                ) {
                  return;
                }
                reportEnded(state.currentVideoId, state.version);
              }}
            />
            <div className="flex flex-col gap-2 p-4">
              <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {currentTrack?.title ??
                  (playback?.currentVideoId
                    ? playback.currentVideoId
                    : "Nothing playing — paste a YouTube link below.")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => (playing ? pause() : play())}
                  disabled={!playback?.currentVideoId}
                  className="rounded bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {playing ? "Pause" : "Play"}
                </button>
                <button
                  onClick={() => prev()}
                  disabled={queue.length === 0}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Prev
                </button>
                <button
                  onClick={() => next()}
                  disabled={queue.length === 0}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Next
                </button>
                <span className="ml-1 text-xs tabular-nums text-zinc-500">
                  {formatTime(nowSec)} / {formatTime(duration)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(duration || 0))}
                value={Math.min(nowSec, Math.floor(duration || 0))}
                onChange={(e) => setNowSec(Number(e.target.value))}
                onMouseUp={(e) => commitSeek(Number(e.currentTarget.value))}
                onTouchEnd={(e) => commitSeek(Number(e.currentTarget.value))}
                onKeyUp={(e) => commitSeek(Number(e.currentTarget.value))}
                disabled={!playback?.currentVideoId}
                className="w-full accent-zinc-900 disabled:opacity-40 dark:accent-zinc-100"
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const url = trackUrl.trim();
                  if (url) {
                    addTrack(url);
                    setTrackUrl("");
                  }
                }}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input
                  value={trackUrl}
                  onChange={(e) => setTrackUrl(e.target.value)}
                  placeholder="Paste a YouTube link to add to the queue"
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!trackUrl.trim()}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 sm:shrink-0 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Add
                </button>
              </form>
              <form onSubmit={runSearch} className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search YouTube..."
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={query.trim().length < 2 || searching}
                  className="shrink-0 rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {searching ? "..." : "Search"}
                </button>
              </form>
              {searchError && (
                <p className="text-xs text-zinc-500">{searchError}</p>
              )}
              {results.length > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-800">
                  {results.map((r) => (
                    <li
                      key={r.videoId}
                      className="flex items-center gap-2 px-2 py-1 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                        {r.title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-400">
                        {formatTime(r.durationSeconds)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          addTrack(`https://youtu.be/${r.videoId}`);
                          setResults([]);
                          setQuery("");
                        }}
                        className="shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {errorCode && (
                <p className="text-xs text-red-600">
                  {ERRORS[errorCode] ?? "Something went wrong."}
                </p>
              )}
            </div>
            <h3 className="border-y border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
              Up next ({queue.length})
            </h3>
            <ul className="max-h-56 overflow-y-auto p-2">
              {queue.map((t) => (
                <li
                  key={t.id}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                    t.id === playback?.currentTrackId
                      ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {t.id === playback?.currentTrackId ? "▶ " : ""}
                    {t.title}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {t.addedBy}
                  </span>
                  <button
                    onClick={() => removeTrack(t.id)}
                    className="shrink-0 text-zinc-400 hover:text-red-600"
                    title="Remove from queue"
                  >
                    &times;
                  </button>
                </li>
              ))}
              {queue.length === 0 && (
                <li className="px-2 py-1 text-sm text-zinc-400">
                  Queue is empty.
                </li>
              )}
            </ul>
          </section>
        </main>

        <aside className="flex min-w-0 flex-col gap-4 lg:h-[calc(100dvh-5rem)] lg:sticky lg:top-4">
          <section className="hidden flex-1 flex-col rounded border border-zinc-200 dark:border-zinc-800 lg:flex">
            <h2 className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
              Chat
            </h2>
            <ul
              ref={chatListRef}
              className="flex-1 overflow-y-auto px-4 py-2 text-sm"
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
          </section>

          <div className="flex flex-col rounded border border-zinc-200 lg:hidden dark:border-zinc-800">
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActivePanel("chat")}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activePanel === "chat"
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/50"
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActivePanel("members")}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activePanel === "members"
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/50"
                }`}
              >
                People ({members.length})
              </button>
            </div>
            {activePanel === "chat" ? (
              <>
                <ul
                  ref={chatListRef}
                  className="h-[40vh] max-h-80 overflow-y-auto px-4 py-2 text-sm sm:h-64"
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
              </>
            ) : (
              <ul className="h-[40vh] max-h-80 overflow-y-auto p-2 sm:h-64">
                {members.map((m) => (
                  <li
                    key={m.clientId}
                    className="px-2 py-1 text-sm text-zinc-800 dark:text-zinc-200"
                  >
                    {m.name}
                    {m.clientId === clientId && (
                      <span className="ml-1 text-xs text-zinc-400">(you)</span>
                    )}
                  </li>
                ))}
                {members.length === 0 && (
                  <li className="px-2 py-1 text-sm text-zinc-400">No members.</li>
                )}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
