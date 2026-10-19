import type { PlaybackState } from "@/hooks/useRoomSocket";

export function serverPosition(
  state: PlaybackState,
  serverNowMs: number,
): number {
  if (!state.playing) return state.position;
  return Math.max(0, state.position + (serverNowMs - state.updatedAt) / 1000);
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
