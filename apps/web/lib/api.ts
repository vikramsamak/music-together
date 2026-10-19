import { API_URL } from "./config";

export async function createRoom(): Promise<string> {
  const res = await fetch(`${API_URL}/api/rooms`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Could not create room (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { roomId: string };
  return data.roomId;
}
