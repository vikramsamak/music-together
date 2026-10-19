export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export function roomUrl(roomId: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/room/${roomId.toUpperCase()}`;
}

export async function shareRoom(
  roomId: string,
  origin?: string,
): Promise<ShareResult> {
  const code = roomId.toUpperCase();
  const url = roomUrl(code, origin);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: `Join room ${code}`,
        text: "Listen to YouTube together, in sync.",
        url,
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function copyRoomUrl(
  roomId: string,
  origin?: string,
): Promise<ShareResult> {
  try {
    await navigator.clipboard.writeText(roomUrl(roomId, origin));
    return "copied";
  } catch {
    return "failed";
  }
}
