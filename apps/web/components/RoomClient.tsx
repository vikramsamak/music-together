"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  Copy,
  Disc,
  Link as LinkIcon,
  ListMusic,
  MessageSquare,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  SkipBack,
  SkipForward,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import AudioVisualizer from "@/components/AudioVisualizer";
import ShareRoom from "@/components/ShareRoom";
import YouTubePlayer, { type PlayerHandle } from "@/components/YouTubePlayer";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useRoomSocket } from "@/hooks/useRoomSocket";
import { useWakeLock } from "@/hooks/useWakeLock";
import { searchVideos, type SearchResult } from "@/lib/api";
import { getAvatarStyle, getInitials } from "@/lib/avatar";
import { useGuestName, useStoredName } from "@/lib/name";
import { formatTime, serverPosition } from "@/lib/playback";
import { recordRecentRoom } from "@/lib/recentRooms";

const ERRORS: Record<string, string> = {
  RATE_LIMITED: "You're sending messages too fast — wait a moment.",
  BAD_REQUEST: "That request wasn't valid.",
  NOT_JOINED: "Not connected to the room yet.",
  BAD_VIDEO: "That doesn't look like a valid YouTube link.",
  QUEUE_FULL: "The queue is full (50 tracks maximum).",
  INTERNAL: "Server hiccup — please try again.",
};

const DRIFT_TOLERANCE_S = 2;
const ENDED_GUARD_S = 2;

const QUICK_EMOJIS = ["🔥", "🎵", "❤️", "👏", "🚀", "🕺"];

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
  const [localPlaying, setLocalPlaying] = useState(false);
  const [activePanel, setActivePanel] = useState<"chat" | "queue" | "members">("chat");
  const [addMode, setAddMode] = useState<"search" | "url">("search");
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);

  const chatListRef = useRef<HTMLUListElement>(null);
  const playerRef = useRef<PlayerHandle | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const serverNowRef = useRef(serverNow);
  const playing = playback?.playing ?? false;
  const currentTrack = queue.find((t) => t.id === playback?.currentTrackId);

  // Record this room in local storage history
  useEffect(() => {
    recordRecentRoom(roomId);
  }, [roomId]);

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
      if (!playbackRef.current?.playing) {
        playerRef.current?.pause();
      }
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

  // Sync player on playback events
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
      const clampedStart = Math.max(0, rawTarget);
      if (state.playing) player.load(state.currentVideoId, clampedStart);
      else player.cue(state.currentVideoId, clampedStart);
      return;
    }

    const dur = player.getDuration();
    const target = dur > 0 ? Math.min(rawTarget, dur) : rawTarget;

    if (state.playing) {
      if (player.isEnded()) {
        if (dur > 0) player.seekTo(Math.max(0, Math.min(target, dur - 1)));
        player.play();
        return;
      }
      if (
        player.isPlaying() &&
        !player.isBuffering() &&
        dur > 0 &&
        Math.abs(player.getCurrentTime() - target) > DRIFT_TOLERANCE_S
      ) {
        player.seekTo(target);
        return;
      }
      if (!player.isPlaying() && !player.isBuffering()) player.play();
    } else {
      // Room is paused: enforce pause and prevent seek-induced autoplay
      if (player.isPlaying()) {
        player.pause();
      }
      if (
        !player.isEnded() &&
        dur > 0 &&
        Math.abs(player.getCurrentTime() - target) > DRIFT_TOLERANCE_S
      ) {
        player.seekTo(target);
        player.pause();
      }
    }
  }, [playbackEvent, playerReady]);

  // Periodic drift check
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

      const dur = player.getDuration();
      const target = dur > 0 ? Math.min(rawTarget, dur) : rawTarget;

      if (player.isEnded()) {
        overToleranceTicks = 0;
        if (dur > 0) player.seekTo(Math.max(0, Math.min(target, dur - 1)));
        player.play();
        return;
      }

      if (player.isPlaying() && !player.isBuffering()) {
        const current = player.getCurrentTime();
        const drift = Math.abs(current - target);
        if (dur > 0 && drift > DRIFT_TOLERANCE_S) {
          overToleranceTicks += 1;
          if (overToleranceTicks >= 2) {
            player.seekTo(target);
            overToleranceTicks = 0;
          }
        } else {
          overToleranceTicks = 0;
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status, playerReady, playbackRef]);

  // Scrubber animation ticker & local playing state
  useEffect(() => {
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player || !playerReady) return;
      setNowSec(player.getCurrentTime());
      const d = player.getDuration();
      if (d > 0) setDuration(d);
      setLocalPlaying(player.isPlaying());
    }, 250);
    return () => clearInterval(timer);
  }, [playerReady]);

  const handleUserSync = () => {
    const player = playerRef.current;
    const state = playbackRef.current;
    if (!player || !state?.currentVideoId) return;
    const rawTarget = serverPosition(state, serverNowRef.current());
    const dur = player.getDuration();
    const target = dur > 0 ? Math.min(rawTarget, dur) : rawTarget;
    player.seekTo(Math.max(0, target));
    player.unMute();
    player.play();
    setLocalPlaying(true);
  };

  // User interaction listener to unblock autoplay if user clicks anywhere in the room
  useEffect(() => {
    const unblock = () => {
      const player = playerRef.current;
      const state = playbackRef.current;
      if (player && state?.playing && !player.isPlaying()) {
        const rawTarget = serverPosition(state, serverNowRef.current());
        const dur = player.getDuration();
        const target = dur > 0 ? Math.min(rawTarget, dur) : rawTarget;
        player.seekTo(Math.max(0, target));
        player.play();
      }
    };
    window.addEventListener("pointerdown", unblock, { passive: true });
    window.addEventListener("keydown", unblock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unblock);
      window.removeEventListener("keydown", unblock);
    };
  }, []);

  const commitSeek = (seconds: number) => {
    seek(seconds);
    playerRef.current?.seekTo(seconds);
    if (!playbackRef.current?.playing) {
      playerRef.current?.pause();
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (muted && newVol > 0) setMuted(false);
    playerRef.current?.setVolume(newVol);
  };

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      playerRef.current?.unMute();
      playerRef.current?.setVolume(volume);
    } else {
      setMuted(true);
      playerRef.current?.mute();
    }
  };

  const runSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchVideos(q));
    } catch {
      setResults([]);
      setSearchError("Search service unavailable — paste a direct YouTube link instead.");
    } finally {
      setSearching(false);
    }
  };

  const handleSendChat = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      sendChat(trimmed);
      setDraft("");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#07080c] text-zinc-100 selection:bg-violet-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-zinc-950/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lobby</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold hidden md:inline">
              Room
            </span>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-950/40 px-3 py-1 font-mono text-sm font-bold tracking-widest text-violet-300 transition-all hover:bg-violet-900/50 hover:border-violet-500/60 active:scale-95"
              title="Click to copy room code"
            >
              <span>{roomId}</span>
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 text-violet-400" />
              )}
            </button>
            {copied && (
              <span className="text-xs text-emerald-400 animate-fade-in hidden sm:inline">
                Copied!
              </span>
            )}
          </div>

          <ShareRoom roomId={roomId} />
        </div>

        {/* Status and Panel Switchers */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "joined"
                  ? "bg-emerald-400 animate-pulse"
                  : status === "connecting"
                  ? "bg-amber-400 animate-ping"
                  : "bg-red-400"
              }`}
            />
            <span className="text-zinc-300 text-[11px] capitalize">
              {status === "joined" ? "Synced" : status}
            </span>
          </div>

          {/* Mobile Panel Switcher */}
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5 lg:hidden">
            <button
              onClick={() => setActivePanel("chat")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                activePanel === "chat"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Chat"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </button>
            <button
              onClick={() => setActivePanel("queue")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                activePanel === "queue"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Queue"
            >
              <ListMusic className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Queue</span>
              <span className="ml-0.5 text-[10px] opacity-75">({queue.length})</span>
            </button>
            <button
              onClick={() => setActivePanel("members")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                activePanel === "members"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="People"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">People</span>
              <span className="ml-0.5 text-[10px] opacity-75">({members.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Grid */}
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_420px] p-4 sm:p-6 gap-6 max-w-[1600px] mx-auto w-full">
        {/* Left Column: Player, Controls, Search & Queue */}
        <main className="flex flex-1 flex-col gap-6 min-w-0">
          {/* Video Player Card */}
          <div className="flex flex-col rounded-3xl border border-white/10 bg-zinc-950/70 p-4 sm:p-6 shadow-2xl backdrop-blur-2xl">
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 mb-1">
              <div className="flex items-center gap-2">
                <Disc className={`h-4 w-4 text-violet-400 ${playing ? "animate-spin" : ""}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Live Stage
                </span>
              </div>
              <AudioVisualizer playing={playing} size="md" barCount={5} />
            </div>

            {/* Embedded YouTube Player */}
            <div className="relative w-full">
              <YouTubePlayer
                ref={playerRef}
                videoId={playback?.currentVideoId || undefined}
                isPlaying={playing}
                onReady={() => setPlayerReady(true)}
                onPlay={() => setLocalPlaying(true)}
                onPause={() => setLocalPlaying(false)}
                onEnded={() => {
                  const state = playbackRef.current;
                  if (!state?.currentVideoId) return;
                  const player = playerRef.current;
                  if (!player) return;
                  const dur = player.getDuration();
                  if (dur > 0 && player.getCurrentTime() <= dur - ENDED_GUARD_S) {
                    return;
                  }
                  reportEnded(state.currentVideoId, state.version);
                }}
              />

              {/* Autoplay blocked overlay: shown if room is playing but local player hasn't started */}
              {playing && !localPlaying && playback?.currentVideoId && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-black/75 backdrop-blur-sm p-4 text-center transition-all animate-in fade-in duration-300">
                  <button
                    type="button"
                    onClick={handleUserSync}
                    className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-white shadow-xl shadow-violet-600/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 group-hover:bg-white/30 transition-colors">
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm sm:text-base">Tap to Listen in Sync</div>
                      <div className="text-xs text-violet-200">Room is currently playing music</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Now Playing Banner & Controls */}
            <div className="mt-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base sm:text-lg font-bold text-white">
                    {currentTrack?.title ??
                      (playback?.currentVideoId
                        ? `Video: ${playback.currentVideoId}`
                        : "Nothing is playing right now")}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                    {currentTrack?.addedBy && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">
                        Added by {currentTrack.addedBy}
                      </span>
                    )}
                    {!playback?.currentVideoId && (
                      <span>Search or paste a YouTube link below to start listening</span>
                    )}
                  </div>
                </div>

                {/* Monospace Time */}
                <div className="shrink-0 font-mono text-xs font-semibold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                  {formatTime(nowSec)} / {formatTime(duration)}
                </div>
              </div>

              {/* Scrubber Range Slider with gradient accent */}
              <div className="flex flex-col gap-1">
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
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500 disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>

              {/* Control Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-2">
                  {/* Previous */}
                  <button
                    type="button"
                    onClick={() => prev()}
                    disabled={queue.length === 0}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition-all hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="Previous track"
                  >
                    <SkipBack className="h-4 w-4" />
                  </button>

                  {/* Play / Pause Primary Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!playing) {
                        play();
                      } else if (!localPlaying) {
                        handleUserSync();
                      } else {
                        pause();
                      }
                    }}
                    disabled={!playback?.currentVideoId}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title={playing ? (localPlaying ? "Pause" : "Join Playback") : "Play"}
                  >
                    {playing && localPlaying ? (
                      <Pause className="h-5 w-5 fill-current" />
                    ) : (
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Next */}
                  <button
                    type="button"
                    onClick={() => next()}
                    disabled={queue.length === 0}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition-all hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    title="Next track"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                </div>

                {/* Volume & Mute Controls */}
                <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/5 px-3 py-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title={muted ? "Unmute" : "Mute"}
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="h-4 w-4 text-red-400" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-zinc-300" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={muted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-16 sm:w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-400"
                    title="Adjust player volume"
                  />
                  <span className="font-mono text-[10px] text-zinc-500 w-6 text-right">
                    {muted ? "0%" : `${volume}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Add Track & Queue Section */}
          <section className="flex flex-col rounded-3xl border border-white/10 bg-zinc-950/70 p-4 sm:p-6 shadow-2xl backdrop-blur-2xl">
            {/* Tab switch between Search and URL */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddMode("search")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    addMode === "search"
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Search YouTube</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("url")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    addMode === "url"
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>Paste URL</span>
                </button>
              </div>

              <span className="text-xs text-zinc-500">
                Queue limit: 50 tracks
              </span>
            </div>

            {/* Mode: Search YouTube */}
            {addMode === "search" && (
              <form onSubmit={runSearch} className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search artist, song, or video title..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={query.trim().length < 2 || searching}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-600/25 hover:bg-violet-500 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                >
                  {searching ? (
                    <span>Searching...</span>
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5" />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Mode: Paste Direct URL */}
            {addMode === "url" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const url = trackUrl.trim();
                  if (url) {
                    addTrack(url);
                    setTrackUrl("");
                  }
                }}
                className="flex gap-2 mb-4"
              >
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    value={trackUrl}
                    onChange={(e) => setTrackUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!trackUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-600/25 hover:bg-violet-500 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Track</span>
                </button>
              </form>
            )}

            {searchError && (
              <p className="text-xs text-amber-400 mb-3">{searchError}</p>
            )}

            {error && (
              <div className="mb-3 rounded-xl border border-red-500/20 bg-red-950/30 p-2.5 text-xs text-red-300">
                {error}
              </div>
            )}

            {errorCode && !error && (
              <div className="mb-3 rounded-xl border border-red-500/20 bg-red-950/30 p-2.5 text-xs text-red-300">
                {ERRORS[errorCode] ?? "Something went wrong."}
              </div>
            )}

            {/* Search Results Dropdown List */}
            {results.length > 0 && (
              <div className="mb-4 flex flex-col gap-1.5 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-2">
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <span>Results ({results.length})</span>
                  <button
                    type="button"
                    onClick={() => setResults([])}
                    className="text-zinc-500 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                {results.map((r) => (
                  <div
                    key={r.videoId}
                    className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5 transition-colors group"
                  >
                    <Image
                      unoptimized
                      src={`https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg`}
                      alt={r.title}
                      width={64}
                      height={40}
                      className="h-10 w-16 object-cover rounded-lg border border-white/10 shrink-0 bg-zinc-900"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-zinc-200 group-hover:text-white">
                        {r.title}
                      </p>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {formatTime(r.durationSeconds)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        addTrack(`https://youtu.be/${r.videoId}`);
                        setResults([]);
                        setQuery("");
                      }}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-violet-600/30 border border-violet-500/30 px-2.5 py-1 text-xs font-semibold text-violet-300 hover:bg-violet-600 hover:text-white transition-all cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Up Next Queue List */}
            <div className="flex items-center justify-between pb-2 mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <ListMusic className="h-4 w-4 text-violet-400" />
                Up Next ({queue.length})
              </h3>
            </div>

            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {queue.map((t, idx) => {
                const isCurrent = t.id === playback?.currentTrackId;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 rounded-2xl border p-2.5 transition-all ${
                      isCurrent
                        ? "border-violet-500/50 bg-gradient-to-r from-violet-950/40 to-indigo-950/20 shadow-lg shadow-violet-600/10"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10"
                    }`}
                  >
                    <span className="w-5 text-center font-mono text-xs text-zinc-500 shrink-0">
                      {idx + 1}
                    </span>

                    {/* Thumbnail */}
                    <Image
                      unoptimized
                      src={`https://i.ytimg.com/vi/${t.videoId}/mqdefault.jpg`}
                      alt={t.title}
                      width={64}
                      height={40}
                      className="h-10 w-16 object-cover rounded-lg border border-white/10 shrink-0 bg-zinc-900"
                    />

                    {/* Title & Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <AudioVisualizer playing={playing} size="sm" barCount={3} />
                        )}
                        <p
                          className={`truncate text-xs font-medium ${
                            isCurrent ? "text-violet-200 font-semibold" : "text-zinc-200"
                          }`}
                        >
                          {t.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-500">
                          by {t.addedBy}
                        </span>
                        {isCurrent && duration > 0 && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="font-mono text-[10px] text-violet-400">
                              {formatTime(nowSec)} / {formatTime(duration)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Delete action */}
                    <button
                      type="button"
                      onClick={() => removeTrack(t.id)}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove from queue"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              {queue.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                  <Music className="h-8 w-8 text-zinc-600 mb-2 stroke-1" />
                  <p className="text-xs text-zinc-400">Queue is empty</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    Search or paste a YouTube URL to get the music playing.
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Right Column: Chat & Room People Sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 sticky top-20 h-[calc(100dvh-6.5rem)]">
          <div className="flex flex-1 flex-col rounded-3xl border border-white/10 bg-zinc-950/70 shadow-2xl backdrop-blur-2xl overflow-hidden">
            {/* Sidebar header tabs */}
            <div className="flex border-b border-white/10 bg-black/20 p-1.5">
              <button
                type="button"
                onClick={() => setActivePanel("chat")}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activePanel === "chat"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Live Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("members")}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activePanel === "members"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>People ({members.length})</span>
              </button>
            </div>

            {/* Chat View */}
            {activePanel === "chat" && (
              <div className="flex flex-1 flex-col justify-between overflow-hidden">
                <ul
                  ref={chatListRef}
                  className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
                >
                  {chat.map((m) => {
                    const isSelf = m.clientId === clientId;
                    const avatarStyle = getAvatarStyle(m.name || m.clientId);
                    return (
                      <li
                        key={m.id}
                        className={`flex gap-2.5 text-xs ${
                          isSelf ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          style={avatarStyle}
                          className="h-7 w-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 shadow-sm"
                        >
                          {getInitials(m.name)}
                        </div>

                        {/* Speech Bubble */}
                        <div
                          className={`max-w-[78%] rounded-2xl px-3 py-2 flex flex-col ${
                            isSelf
                              ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20"
                              : "bg-white/5 border border-white/10 text-zinc-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span
                              className={`font-semibold text-[11px] truncate ${
                                isSelf ? "text-violet-100" : "text-violet-400"
                              }`}
                            >
                              {m.name}
                            </span>
                            <span
                              className={`text-[9px] ${
                                isSelf ? "text-violet-200" : "text-zinc-500"
                              }`}
                            >
                              {new Date(m.at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="break-words leading-relaxed text-xs">
                            {m.text}
                          </p>
                        </div>
                      </li>
                    );
                  })}

                  {chat.length === 0 && (
                    <div className="flex flex-1 flex-col items-center justify-center text-center p-6 text-zinc-500">
                      <MessageSquare className="h-8 w-8 stroke-1 mb-2 text-zinc-600" />
                      <p className="text-xs">No messages yet.</p>
                      <p className="text-[11px] text-zinc-600">Say hi to everyone in the room!</p>
                    </div>
                  )}
                </ul>

                {/* Quick Emoji Reactions */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-white/5 bg-black/30 overflow-x-auto">
                  <span className="text-[10px] text-zinc-500 shrink-0">React:</span>
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSendChat(emoji)}
                      className="rounded-lg p-1 text-sm hover:scale-125 transition-transform cursor-pointer"
                      title={`Send ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Chat Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat(draft);
                  }}
                  className="flex gap-2 p-3 border-t border-white/10 bg-black/40"
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={500}
                    placeholder="Type a message..."
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-3 py-2 text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 active:scale-95 disabled:opacity-30 transition-all cursor-pointer"
                    title="Send message"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* Members View */}
            {activePanel === "members" && (
              <div className="flex flex-1 flex-col overflow-y-auto p-4 gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Active Listeners ({members.length})
                </span>
                {members.map((m) => {
                  const isSelf = m.clientId === clientId;
                  const avatarStyle = getAvatarStyle(m.name || m.clientId);
                  return (
                    <div
                      key={m.clientId}
                      className="flex items-center justify-between gap-2.5 rounded-2xl border border-white/5 bg-white/[0.02] p-2.5 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          style={avatarStyle}
                          className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm"
                        >
                          {getInitials(m.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-zinc-200">
                            {m.name}
                          </p>
                          <span className="text-[10px] text-zinc-500">
                            {isSelf ? "You (Host / Listener)" : "Listener"}
                          </span>
                        </div>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Mobile View Drawer / Tabs (when screen width < 1024px) */}
        <div className="lg:hidden flex flex-col rounded-3xl border border-white/10 bg-zinc-950/70 shadow-2xl backdrop-blur-2xl overflow-hidden mt-2">
          {activePanel === "chat" && (
            <div className="flex flex-col h-80">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/20">
                <span className="text-xs font-bold text-zinc-300">Live Chat</span>
                <span className="text-[11px] text-zinc-500">{chat.length} messages</span>
              </div>
              <ul
                ref={chatListRef}
                className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5"
              >
                {chat.map((m) => {
                  const isSelf = m.clientId === clientId;
                  const avatarStyle = getAvatarStyle(m.name || m.clientId);
                  return (
                    <li
                      key={m.id}
                      className={`flex gap-2 text-xs ${
                        isSelf ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        style={avatarStyle}
                        className="h-6 w-6 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0"
                      >
                        {getInitials(m.name)}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-xl px-2.5 py-1.5 ${
                          isSelf
                            ? "bg-violet-600 text-white"
                            : "bg-white/5 border border-white/10 text-zinc-200"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-semibold text-[10px]">
                            {m.name}
                          </span>
                          <span className="text-[8px] opacity-75">
                            {new Date(m.at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="break-words text-xs">{m.text}</p>
                      </div>
                    </li>
                  );
                })}
                {chat.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center my-auto">
                    No messages yet. Say hi!
                  </p>
                )}
              </ul>
              {/* Quick Emojis on Mobile */}
              <div className="flex items-center gap-2 px-3 py-1 border-t border-white/5 bg-black/30 overflow-x-auto">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendChat(emoji)}
                    className="p-1 text-sm"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat(draft);
                }}
                className="flex gap-2 p-2 border-t border-white/10 bg-black/40"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={500}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </div>
          )}

          {activePanel === "members" && (
            <div className="flex flex-col h-72 p-3 overflow-y-auto gap-2">
              <span className="text-xs font-bold text-zinc-300 pb-2 border-b border-white/10">
                Connected Members ({members.length})
              </span>
              {members.map((m) => (
                <div
                  key={m.clientId}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-zinc-200">
                    {m.name} {m.clientId === clientId && "(You)"}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
