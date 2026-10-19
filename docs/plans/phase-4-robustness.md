# Phase 4 — Robustness & lifecycle

## Goals

Survive disconnects and restarts, clean up dead rooms, harden the WS surface.

## Tasks

- [x] API: on `ENDED` report (any client), advance queue once, guarded by `version` (ignore stale reports)
- [x] API: room lifecycle — refresh TTL on activity, delete `room:*` keys ~30 min after empty/abandoned
- [x] API: zod schema on every inbound message; queue cap (50); name cap (24 chars); drop malformed frames without crash
- [x] Web: persisted `mt.clientId` used for identity; socket.io auto-reconnect + re-`join`; full snapshot resync on reconnect
- [x] Presence: handleDisconnect removes member; reconnect with same `clientId` does not duplicate
- [x] API: per-room command lock — read-modify-write commands (play/pause/seek/next/prev/ended/queue) are serialized so concurrent clients cannot double-apply a transition

## Verification

- [x] `node scripts/restart-smoke.mjs` — kill/restart API → client reconnects, re-joins, chat + queue + playback restored
- [x] `node scripts/robustness-smoke.mjs` — malformed/oversized frames rejected, server stays up; queue cap; ENDED-once with two reporters; presence dedupe; active TTL 24 h → empty TTL 30 min
- [x] Close one tab → others see member leave (presence:update)
- [x] Empty room → keys expire in Redis (`redis-cli KEYS 'room:*'`) — TTL asserted at 1800 s (actual expiry not waited on)
- [x] Malformed / oversized frames → rejected, server stays up
- [x] Video end → queue advances exactly once even with 2+ clients reporting

## Notes

- The empty-room grace period is 30 min (`EMPTY_ROOM_TTL_SECONDS`); an active room is refreshed to 24 h on join, chat, queue or playback activity.
