"use client";

import { useEffect, useRef } from "react";
import type { PlaybackState, Track } from "@/hooks/useRoomSocket";

interface MediaSessionArgs {
  track: Track | null;
  playback: PlaybackState | null;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (position: number) => void;
}

const ACTIONS: MediaSessionAction[] = [
  "play",
  "pause",
  "nexttrack",
  "previoustrack",
  "seekto",
];

export function useMediaSession({
  track,
  playback,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
}: MediaSessionArgs) {
  const handlers = useRef({ onPlay, onPause, onNext, onPrev, onSeek });
  useEffect(() => {
    handlers.current = { onPlay, onPause, onNext, onPrev, onSeek };
  });

  const videoId = track?.videoId ?? null;
  const title = track?.title ?? null;
  const addedBy = track?.addedBy ?? null;
  const playing = playback?.playing ?? false;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const session = navigator.mediaSession;
    if (!title) {
      session.metadata = null;
      return;
    }
    session.metadata = new MediaMetadata({
      title,
      artist: addedBy ? `Added by ${addedBy}` : "music-together",
      album: "music-together",
      artwork: videoId
        ? [
            {
              src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              sizes: "480x360",
              type: "image/jpeg",
            },
          ]
        : [],
    });
  }, [title, addedBy, videoId]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const session = navigator.mediaSession;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // action not supported by this browser
      }
    };

    set("play", () => handlers.current.onPlay());
    set("pause", () => handlers.current.onPause());
    set("nexttrack", () => handlers.current.onNext());
    set("previoustrack", () => handlers.current.onPrev());
    set("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        handlers.current.onSeek(details.seekTime);
      }
    });

    return () => {
      for (const action of ACTIONS) set(action, null);
    };
  }, []);
}
