import { API_URL } from "./config";

export interface SearchResult {
  videoId: string;
  title: string;
  durationSeconds: number;
  channel: string;
}

export async function createRoom(): Promise<string> {
  const res = await fetch(`${API_URL}/api/rooms`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Could not create room (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { roomId: string };
  return data.roomId;
}

export async function searchVideos(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `${API_URL}/api/search?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) {
    throw new Error(`Search failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { results?: SearchResult[] };
  return data.results ?? [];
}
