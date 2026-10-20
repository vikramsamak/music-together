"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  Compass,
  Headphones,
  Music,
  Plus,
  Radio,
  Shuffle,
  Sparkles,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import AudioVisualizer from "@/components/AudioVisualizer";
import { createRoom } from "@/lib/api";
import { setStoredName, useStoredName } from "@/lib/name";
import { recordRecentRoom, useRecentRooms } from "@/lib/recentRooms";

const MUSICAL_NICKNAMES = [
  "Cosmic Groove",
  "Velvet Bass",
  "Neon Echo",
  "Sunset Melody",
  "Electric Wave",
  "Starlight Jam",
  "Midnight Vinyl",
  "Retro Rhythm",
  "Solar Synth",
  "Lunar Beat",
];

export default function Home() {
  const router = useRouter();
  const stored = useStoredName();
  const recentRooms = useRecentRooms();
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const name = nameOverride ?? stored ?? "";
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChangeName = (value: string) => {
    setNameOverride(value);
    setStoredName(value);
  };

  const handleRandomizeName = () => {
    const randomNick =
      MUSICAL_NICKNAMES[Math.floor(Math.random() * MUSICAL_NICKNAMES.length)];
    const num = Math.floor(10 + Math.random() * 90);
    const chosen = `${randomNick} #${num}`;
    onChangeName(chosen);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const roomId = await createRoom();
      recordRecentRoom(roomId);
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not create a room. Is the API server running on port 3001?",
      );
      setBusy(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(code)) {
      recordRecentRoom(code);
      router.push(`/room/${code}`);
    } else {
      setError("Room codes must be exactly 6 characters.");
    }
  };

  const formatVisitedTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="relative min-h-dvh flex flex-col justify-between overflow-hidden bg-[#07080c] text-zinc-100 selection:bg-violet-500 selection:text-white">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-gradient-to-tr from-violet-600/20 via-fuchsia-600/15 to-cyan-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 right-10 h-[400px] w-[500px] rounded-full bg-cyan-600/10 blur-[120px]" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 shadow-lg shadow-violet-600/25">
            <Headphones className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-lg text-white">
              music-together
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Realtime Audio Studio</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
          <AudioVisualizer playing={true} size="sm" barCount={4} />
          <span className="text-xs font-medium text-zinc-300">
            Sync v2 Online
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto w-full">
        {/* Hero Tagline */}
        <div className="text-center max-w-2xl mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300 mb-4 backdrop-blur-sm">
            <Radio className="h-3.5 w-3.5 text-violet-400 animate-pulse" />
            <span>Shared YouTube Listening Rooms</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Sync your sound.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-400 bg-clip-text text-transparent">
              Listen together in real time.
            </span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 max-w-xl mx-auto">
            Create an audio room, invite your friends, and listen to YouTube music
            in frame-perfect synchronization with a live queue and chat.
          </p>
        </div>

        {/* Central Action Box */}
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950/70 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
          {/* Name customization input */}
          <div className="mb-6 pb-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="display-name"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5"
              >
                <Users className="h-3.5 w-3.5 text-violet-400" />
                Your DJ Name
              </label>
              <button
                type="button"
                onClick={handleRandomizeName}
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                title="Generate a random musical nickname"
              >
                <Shuffle className="h-3 w-3" />
                <span>Randomize</span>
              </button>
            </div>

            <div className="relative">
              <input
                id="display-name"
                value={name}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="Enter your nickname..."
                maxLength={24}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-violet-500/50 focus:bg-white/10 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-400">
              Saved automatically. Leave blank to be assigned a random guest name.
            </p>
          </div>

          {/* Action Tabs / Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Create Room Button */}
            <div className="flex flex-col justify-between rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-950/30 to-violet-900/10 p-5 hover:border-violet-500/50 transition-all">
              <div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/30 text-violet-300 mb-3 border border-violet-500/20">
                  <Plus className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-white text-base">New Room</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-4">
                  Host a room and invite your friends with a 6-letter code.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
              >
                {busy ? (
                  <span>Creating Room...</span>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Create Room</span>
                  </>
                )}
              </button>
            </div>

            {/* Join Room Form */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/20 transition-all">
              <div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600/20 text-cyan-300 mb-3 border border-cyan-500/20">
                  <Compass className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-white text-base">Join Room</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-3">
                  Enter an existing 6-character room code to join.
                </p>
              </div>

              <form onSubmit={handleJoin} className="flex flex-col gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CODE12"
                  maxLength={6}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-center text-base tracking-widest uppercase text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={joinCode.trim().length !== 6}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-900/50 active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer"
                >
                  <span>Join</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300 text-center">
              {error}
            </div>
          )}

          {/* Recent Rooms Shelf */}
          {recentRooms.length > 0 && (
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-zinc-400" />
                  Recent Rooms
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentRooms.map((r) => (
                  <Link
                    key={r.code}
                    href={`/room/${r.code}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:border-violet-500/40 hover:bg-white/10 hover:text-white transition-all group"
                  >
                    <span className="font-mono font-bold tracking-wider text-violet-400 group-hover:text-violet-300">
                      {r.code}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {formatVisitedTime(r.visitedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feature Pills */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
          <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-200">
                Drift-Free Sync
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                Server-clock alignment continuously syncs playback down to the millisecond.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <Music className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-200">
                Collaborative Queue
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                Search YouTube directly or paste video links to build a playlist together.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400">
              <Volume2 className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-200">
                Mobile & Background Audio
              </h4>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                Native MediaSession lock-screen controls and screen-lock support.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-zinc-600 border-t border-white/5">
        <p>Built for shared music moments · No accounts needed</p>
      </footer>
    </div>
  );
}
