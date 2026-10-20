"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ENDED,
  PAUSED,
  PLAYING,
  loadYouTubeApi,
  type YTNamespace,
  type YTPlayer,
} from "@/lib/youtube";

export interface PlayerHandle {
  load(videoId: string, startSeconds?: number): void;
  cue(videoId: string, startSeconds?: number): void;
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  isEnded(): boolean;
  isBuffering(): boolean;
  isPaused(): boolean;
  isReady(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
}

const YouTubePlayer = forwardRef<
  PlayerHandle,
  {
    onEnded: () => void;
    onReady?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    isPlaying?: boolean;
  }
>(function YouTubePlayer(
  { onEnded, onReady, onPlay, onPause, isPlaying = false },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const elementIdRef = useRef(
    `yt-player-${Math.random().toString(36).slice(2, 10)}`,
  );
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const endedRef = useRef(onEnded);
  const onReadyRef = useRef(onReady);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    endedRef.current = onEnded;
    onReadyRef.current = onReady;
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
  }, [onEnded, onReady, onPlay, onPause]);

  useEffect(() => {
    let cancelled = false;
    void loadYouTubeApi().then(
      (YT: YTNamespace) => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new YT.Player(elementIdRef.current, {
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              readyRef.current = true;
              onReadyRef.current?.();
            },
            onStateChange: (event) => {
              if (event.data === ENDED) {
                endedRef.current();
              } else if (event.data === PLAYING) {
                onPlayRef.current?.();
              } else if (event.data === PAUSED) {
                onPauseRef.current?.();
              }
            },
          },
        });
      },
      (err: Error) => {
        if (!cancelled) setLoadError(err.message);
      },
    );
    return () => {
      cancelled = true;
      readyRef.current = false;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => {
      const active = () => (readyRef.current ? playerRef.current : null);
      return {
        load: (videoId, startSeconds = 0) =>
          active()?.loadVideoById({ videoId, startSeconds }),
        cue: (videoId, startSeconds = 0) =>
          active()?.cueVideoById({ videoId, startSeconds }),
        play: () => active()?.playVideo(),
        pause: () => active()?.pauseVideo(),
        seekTo: (seconds) => active()?.seekTo(seconds, true),
        getCurrentTime: () => active()?.getCurrentTime() ?? 0,
        getDuration: () => active()?.getDuration() ?? 0,
        isPlaying: () => active()?.getPlayerState() === 1,
        isEnded: () => active()?.getPlayerState() === ENDED,
        isBuffering: () => active()?.getPlayerState() === 3,
        isPaused: () => active()?.getPlayerState() === 2,
        isReady: () => readyRef.current,
        setVolume: (v) => active()?.setVolume?.(v),
        getVolume: () => active()?.getVolume?.() ?? 100,
        mute: () => active()?.mute?.(),
        unMute: () => active()?.unMute?.(),
        isMuted: () => active()?.isMuted?.() ?? false,
      };
    },
    [],
  );

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl border border-white/10 group">
      {/* Ambient glow behind the player */}
      <div
        className={`pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-r from-violet-600/20 via-cyan-500/15 to-fuchsia-600/20 blur-xl transition-opacity duration-700 ${
          isPlaying ? "opacity-100" : "opacity-0"
        }`}
      />
      <div ref={hostRef} className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        {loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-red-400">
            <span className="font-medium">Could not load YouTube player</span>
            <span className="text-xs text-zinc-500">{loadError}</span>
          </div>
        ) : (
          <div id={elementIdRef.current} className="h-full w-full" />
        )}
      </div>
    </div>
  );
});

export default YouTubePlayer;
