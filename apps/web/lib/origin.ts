"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function useOrigin(): string {
  return useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => "",
  );
}
