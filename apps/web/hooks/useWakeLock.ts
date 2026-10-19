"use client";

import { useEffect } from "react";

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        sentinel.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        sentinel = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !sentinel && !disposed) {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}
