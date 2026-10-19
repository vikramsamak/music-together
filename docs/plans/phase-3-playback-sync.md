# Phase 3 — Playback sync (core)

## Goals

Everyone in a room hears the same track at (nearly) the same time. Any member can
control playback. Tracks are added by pasting a YouTube / YT Music URL.

## Tasks

- [x] Web: YouTube IFrame player component (client-only; `iframe_api` loaded in `useEffect`); autoplay requires a user gesture — tracks start paused
- [x] Web: URL parsing → `videoId` (`watch?v=`, `youtu.be/`, `music.youtube.com`) on the API; `queue:add` on paste
- [x] API: queue in `room:{id}:queue`; broadcast `queue:update`; `queue:remove`
- [x] API: server-authoritative playback state in `room:{id}` hash — `{ currentVideoId, currentTrackId, playing, position, updatedAt, version }`; `player:play/pause/seek/next/prev` update state, bump `version`, broadcast `playback:update { state, senderId, now }`
- [x] Web: apply `playback:update` to the player idempotently (own echo is a no-op); drift-correction loop every 5 s — server position = `position + (playing ? (now - updatedAt)/1000 : 0)`; seek if |drift| > 2 s
- [x] Web: queue panel (current track, upcoming, remove button)

## Verification

- [x] server-authoritative protocol — `node scripts/playback-smoke.mjs` (queue, current-track promotion, play/pause/seek, next, stale-end guard, BAD_VIDEO) — 24 assertions
- [ ] Tab A play/pause → tab B follows within ~1 s (manual, browser)
- [ ] Seek on A → B jumps (drift-corrected) (manual, browser)
- [ ] Paste URL on B → A gets queue update and loads track when it becomes current (manual, browser)
- [ ] Idle 60 s → measured drift between tabs < 2 s (manual, browser)

## Notes

- `version` guards stale/duplicate commands (also used by the `ENDED` advance).
- Stream download/extraction is explicitly out of scope — IFrame embed only.
- Track titles are resolved server-side via YouTube oEmbed (no API key), falling back to the video id.
