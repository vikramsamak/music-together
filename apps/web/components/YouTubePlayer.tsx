"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ENDED, loadYouTubeApi, type YTPlayer } from "@/lib/youtube";

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

  useEffect(() => {
    endedRef.current = onEnded;
    onReadyRef.current = onReady;
  }, [onEnded, onReady]);

  useEffect(() => {
    let cancelled = false;
    void loadYouTubeApi().then((YT) => {
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
    });
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
        isReady: () => readyRef.current,
      };
    },
    [],
  );

  return (
    <div ref={hostRef} className="aspect-video w-full bg-black">
      <div id={elementIdRef.current} className="h-full w-full" />
    </div>
  );
});

export default YouTubePlayer;
