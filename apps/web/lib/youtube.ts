export interface YTPlayer {
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  loadVideoById(videoId: string, startSeconds?: number): void;
  cueVideoById(options: { videoId: string; startSeconds?: number }): void;
  cueVideoById(videoId: string, startSeconds?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setVolume?(volume: number): void;
  getVolume?(): number;
  mute?(): void;
  unMute?(): void;
  isMuted?(): boolean;
  destroy(): void;
}

export interface YTNamespace {
  Player: new (
    element: string | HTMLElement,
    options: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number | boolean | undefined>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const PLAYING = 1;
export const PAUSED = 2;
export const BUFFERING = 3;
export const ENDED = 0;

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API needs a browser"));
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const fail = (msg: string) => {
      apiPromise = null; // allow retry on next mount
      reject(new Error(msg));
    };

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else fail("YT.Player unavailable after API ready");
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => fail("Failed to load YouTube IFrame API");
    document.head.appendChild(script);

    // Safety net: if neither onReady nor onerror fires within 10 s
    setTimeout(() => fail("YouTube API load timed out"), 10_000);
  });

  return apiPromise;
}
