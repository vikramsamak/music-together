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
}

const YouTubePlayer = forwardRef<PlayerHandle, { onEnded: () => void }>(
  function YouTubePlayer({ onEnded }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const elementIdRef = useRef(
      `yt-player-${Math.random().toString(36).slice(2, 10)}`,
    );
    const playerRef = useRef<YTPlayer | null>(null);
    const endedRef = useRef(onEnded);

    useEffect(() => {
      endedRef.current = onEnded;
    }, [onEnded]);

    useEffect(() => {
      let cancelled = false;
      void loadYouTubeApi().then((YT) => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new YT.Player(elementIdRef.current, {
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onStateChange: (event) => {
              if (event.data === ENDED) endedRef.current();
            },
          },
        });
      });
      return () => {
        cancelled = true;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        load: (videoId, startSeconds = 0) =>
          playerRef.current?.loadVideoById({ videoId, startSeconds }),
        cue: (videoId, startSeconds = 0) =>
          playerRef.current?.cueVideoById({ videoId, startSeconds }),
        play: () => playerRef.current?.playVideo(),
        pause: () => playerRef.current?.pauseVideo(),
        seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
        getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
        getDuration: () => playerRef.current?.getDuration() ?? 0,
        isPlaying: () => playerRef.current?.getPlayerState() === 1,
      }),
      [],
    );

    return (
      <div ref={hostRef} className="aspect-video w-full bg-black">
        <div id={elementIdRef.current} className="h-full w-full" />
      </div>
    );
  },
);

export default YouTubePlayer;
