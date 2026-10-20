"use client";

import { useSyncExternalStore } from "react";

const RECENT_ROOMS_KEY = "mt.recentRooms";
const MAX_RECENT_ROOMS = 5;

export interface RecentRoom {
  code: string;
  visitedAt: number;
}

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

let cachedSnapshot: RecentRoom[] = [];
let lastRaw: string | null = null;

function getRecentRoomsSnapshot(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_ROOMS_KEY);
    if (raw === lastRaw) {
      return cachedSnapshot;
    }
    lastRaw = raw;
    if (!raw) {
      cachedSnapshot = [];
      return cachedSnapshot;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cachedSnapshot = parsed.slice(0, MAX_RECENT_ROOMS);
    } else {
      cachedSnapshot = [];
    }
    return cachedSnapshot;
  } catch {
    return cachedSnapshot;
  }
}

export function recordRecentRoom(code: string) {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return;
  try {
    const current = getRecentRoomsSnapshot();
    const updated = [
      { code: cleanCode, visitedAt: Date.now() },
      ...current.filter((r) => r.code !== cleanCode),
    ].slice(0, MAX_RECENT_ROOMS);
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated));
    lastRaw = null;
    notify();
  } catch {
    // Ignore storage errors
  }
}

export function clearRecentRooms() {
  try {
    localStorage.removeItem(RECENT_ROOMS_KEY);
    lastRaw = null;
    notify();
  } catch {
    // Ignore
  }
}

export function useRecentRooms(): RecentRoom[] {
  return useSyncExternalStore(subscribe, getRecentRoomsSnapshot, () => []);
}
