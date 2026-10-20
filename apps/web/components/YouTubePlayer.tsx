"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ENDED, loadYouTubeApi, type YTNamespace, type YTPlayer } from "@/lib/youtube";

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
}

const YouTubePlayer = forwardRef<
  PlayerHandle,
  { onEnded: () => void; onReady?: () => void }
>(function YouTubePlayer({ onEnded, onReady }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const elementIdRef = useRef(
    `yt-player-${Math.random().toString(36).slice(2, 10)}`,
  );
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const endedRef = useRef(onEnded);
  const onReadyRef = useRef(onReady);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    endedRef.current = onEnded;
    onReadyRef.current = onReady;
  }, [onEnded, onReady]);

  useEffect(() => {
    let cancelled = false;
    void loadYouTubeApi().then(
      (YT: YTNamespace) => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new YT.Player(elementIdRef.current, {
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: () => {
              readyRef.current = true;
              onReadyRef.current?.();
            },
            onStateChange: (event) => {
              if (event.data === ENDED) endedRef.current();
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
      };
    },
    [],
  );

  return (
    <div ref={hostRef} className="aspect-video w-full bg-black">
      {loadError ? (
        <div className="flex h-full items-center justify-center text-sm text-red-400 px-4 text-center">
          Could not load YouTube player: {loadError}
        </div>
      ) : (
        <div id={elementIdRef.current} className="h-full w-full" />
      )}
    </div>
  );
});

export default YouTubePlayer;
