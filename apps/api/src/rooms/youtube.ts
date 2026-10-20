const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoId(input: string): string | null {
  const raw = input.trim();
  if (VIDEO_ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return VIDEO_ID_RE.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    const id = url.searchParams.get('v') ?? url.pathname.split('/').pop() ?? '';
    return VIDEO_ID_RE.test(id) ? id : null;
  }
  return null;
}

// Cache results (and in-flight promises) so concurrent adds of the same video
// share one oEmbed request and repeated adds never re-fetch.
const titleCache = new Map<string, Promise<string>>();

export function fetchVideoTitle(videoId: string): Promise<string> {
  const hit = titleCache.get(videoId);
  if (hit) return hit;
  const promise = _fetchTitle(videoId);
  titleCache.set(videoId, promise);
  // On failure, evict so the next add can retry.
  promise.catch(() => titleCache.delete(videoId));
  return promise;
}

async function _fetchTitle(videoId: string): Promise<string> {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return videoId;
    const data = (await res.json()) as { title?: unknown };
    return typeof data.title === 'string' && data.title.trim()
      ? data.title.trim().slice(0, 200)
      : videoId;
  } catch {
    return videoId;
  }
}

