"use client";

import { useSyncExternalStore } from "react";

const NAME_KEY = "mt.displayName";

const emptySubscribe = () => () => {};

let cachedGuest: string | null = null;

export function getStoredName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function setStoredName(name: string) {
  const trimmed = name.trim().slice(0, 24);
  if (trimmed) {
    localStorage.setItem(NAME_KEY, trimmed);
  } else {
    localStorage.removeItem(NAME_KEY);
  }
}

export function generateGuestName(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Guest-${suffix}`;
}

export function useStoredName(): string | null {
  return useSyncExternalStore(emptySubscribe, getStoredName, () => null);
}

export function useGuestName(): string {
  return useSyncExternalStore(
    emptySubscribe,
    () => {
      if (!cachedGuest) cachedGuest = generateGuestName();
      return cachedGuest;
    },
    () => "",
  );
}
