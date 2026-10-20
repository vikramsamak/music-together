"use client";

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  BUFFERING,
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

export interface YouTubePlayerProps {
  videoId?: string;
  onEnded: () => void;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  isPlaying?: boolean;
}

const YouTubePlayer = memo(
  forwardRef<PlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
    { videoId, onEnded, onReady, onPlay, onPause, isPlaying = false },
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
    const initialVideoIdRef = useRef(videoId);
    const pendingCommandRef = useRef<{
      type: "load" | "cue";
      videoId: string;
      startSeconds: number;
    } | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
      endedRef.current = onEnded;
      onReadyRef.current = onReady;
      onPlayRef.current = onPlay;
      onPauseRef.current = onPause;
    }, [onEnded, onReady, onPlay, onPause]);

    useEffect(() => {
      let cancelled = false;
      const host = hostRef.current;
      if (!host) return;

      // Pure DOM insertion so React reconciliation never touches or deletes the iframe
      const container = document.createElement("div");
      container.id = elementIdRef.current;
      container.style.width = "100%";
      container.style.height = "100%";
      host.replaceChildren(container);

      void loadYouTubeApi().then(
        (YT: YTNamespace) => {
          if (cancelled || !hostRef.current) return;
          playerRef.current = new YT.Player(container, {
            width: "100%",
            height: "100%",
            videoId: initialVideoIdRef.current || undefined,
            playerVars: {
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              enablejsapi: 1,
              origin:
                typeof window !== "undefined"
                  ? window.location.origin
                  : undefined,
            },
            events: {
              onReady: () => {
                if (cancelled) return;
                readyRef.current = true;
                if (pendingCommandRef.current) {
                  const cmd = pendingCommandRef.current;
                  pendingCommandRef.current = null;
                  const sec = Math.max(0, Math.floor(cmd.startSeconds));
                  try {
                    if (cmd.type === "load") {
                      playerRef.current?.loadVideoById({
                        videoId: cmd.videoId,
                        startSeconds: sec,
                      });
                    } else {
                      playerRef.current?.cueVideoById({
                        videoId: cmd.videoId,
                        startSeconds: sec,
                      });
                    }
                  } catch {
                    // ignore
                  }
                }
                onReadyRef.current?.();
              },
              onStateChange: (event) => {
                if (cancelled) return;
                if (event.data === ENDED) {
                  endedRef.current();
                } else if (event.data === PLAYING) {
                  onPlayRef.current?.();
                } else if (event.data === PAUSED) {
                  onPauseRef.current?.();
                }
              },
              onError: (err) => {
                console.warn("YouTube player error:", err.data);
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
        try {
          playerRef.current?.destroy();
        } catch {
          // ignore cleanup errors
        }
        playerRef.current = null;
        if (host) {
          host.replaceChildren();
        }
      };
    }, []);

    useImperativeHandle(
      ref,
      () => {
        const active = () => (readyRef.current ? playerRef.current : null);
        return {
          load: (vId, startSeconds = 0) => {
            const p = active();
            const sec = Math.max(0, Math.floor(startSeconds));
            if (!p) {
              pendingCommandRef.current = {
                type: "load",
                videoId: vId,
                startSeconds: sec,
              };
              return;
            }
            try {
              p.loadVideoById({ videoId: vId, startSeconds: sec });
            } catch {
              p.loadVideoById(vId, sec);
            }
          },
          cue: (vId, startSeconds = 0) => {
            const p = active();
            const sec = Math.max(0, Math.floor(startSeconds));
            if (!p) {
              pendingCommandRef.current = {
                type: "cue",
                videoId: vId,
                startSeconds: sec,
              };
              return;
            }
            try {
              p.cueVideoById({ videoId: vId, startSeconds: sec });
            } catch {
              p.cueVideoById(vId, sec);
            }
          },
          play: () => {
            try {
              active()?.playVideo();
            } catch {
              // ignore
            }
          },
          pause: () => {
            try {
              active()?.pauseVideo();
            } catch {
              // ignore
            }
          },
          seekTo: (seconds) => {
            try {
              active()?.seekTo(Math.max(0, seconds), true);
            } catch {
              // ignore
            }
          },
          getCurrentTime: () => {
            try {
              return active()?.getCurrentTime() ?? 0;
            } catch {
              return 0;
            }
          },
          getDuration: () => {
            try {
              return active()?.getDuration() ?? 0;
            } catch {
              return 0;
            }
          },
          isPlaying: () => {
            try {
              return active()?.getPlayerState() === PLAYING;
            } catch {
              return false;
            }
          },
          isEnded: () => {
            try {
              return active()?.getPlayerState() === ENDED;
            } catch {
              return false;
            }
          },
          isBuffering: () => {
            try {
              return active()?.getPlayerState() === BUFFERING;
            } catch {
              return false;
            }
          },
          isPaused: () => {
            try {
              return active()?.getPlayerState() === PAUSED;
            } catch {
              return false;
            }
          },
          isReady: () => readyRef.current,
          setVolume: (v) => {
            try {
              active()?.setVolume?.(v);
            } catch {
              // ignore
            }
          },
          getVolume: () => {
            try {
              return active()?.getVolume?.() ?? 100;
            } catch {
              return 100;
            }
          },
          mute: () => {
            try {
              active()?.mute?.();
            } catch {
              // ignore
            }
          },
          unMute: () => {
            try {
              active()?.unMute?.();
            } catch {
              // ignore
            }
          },
          isMuted: () => {
            try {
              return active()?.isMuted?.() ?? false;
            } catch {
              return false;
            }
          },
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
        <div
          ref={hostRef}
          className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black"
        >
          {loadError && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-red-400">
              <span className="font-medium">Could not load YouTube player</span>
              <span className="text-xs text-zinc-500">{loadError}</span>
            </div>
          )}
        </div>
      </div>
    );
  }),
);

YouTubePlayer.displayName = "YouTubePlayer";

export default YouTubePlayer;
