# Phase 3 — Playback sync (core)

## Goals

Everyone in a room hears the same track at (nearly) the same time. Any member can
control playback. Tracks are added by pasting a YouTube / YT Music URL.

## Tasks

- [ ] Web: YouTube IFrame player component (client-only: `next/dynamic` `ssr:false`, load `iframe_api` in `useEffect`); autoplay requires a user gesture — start paused
- [ ] Web: URL parsing → `videoId` (`watch?v=`, `youtu.be/`, `music.youtube.com`); `queue:add` on paste
- [ ] API: queue in `room:{id}:queue`; broadcast `queue:update`; `queue:remove`
- [ ] API: server-authoritative playback state in `room:{id}` hash — `{ currentVideoId, playing, position, updatedAt, version }`; `player:play/pause/seek/next/prev` update state, bump `version`, broadcast `playback:update { state, senderId }`
- [ ] Web: apply `playback:update` to player (skip own `senderId` echo); drift-correction loop every 5 s — server position = `position + (playing ? (now - updatedAt)/1000 : 0)`; seek if |drift| > 2 s
- [ ] Web: queue panel (current track, upcoming, remove button)

## Verification

- [ ] Tab A play/pause → tab B follows within ~1 s
- [ ] Seek on A → B jumps (drift-corrected)
- [ ] Paste URL on B → A gets queue update and loads track when it becomes current
- [ ] Idle 60 s → measured drift between tabs < 2 s

## Notes

- `version` guards stale/duplicate commands (needed for `ENDED` advance in Phase 4).
- Stream download/extraction is explicitly out of scope — IFrame embed only.
