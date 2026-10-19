# Phase 4 — Robustness & lifecycle

## Goals

Survive disconnects and restarts, clean up dead rooms, harden the WS surface.

## Tasks

- [ ] API: on `ENDED` report (any client), advance queue once, guarded by `version` (ignore stale reports)
- [ ] API: room lifecycle — refresh TTL on activity, delete `room:*` keys ~30 min after empty/abandoned
- [ ] API: zod schema on every inbound message; queue cap (50); name cap (24 chars); drop malformed frames without crash
- [ ] Web: persisted `mt.clientId` used for identity; socket.io auto-reconnect + re-`join`; full snapshot resync on reconnect
- [ ] Presence: handleDisconnect removes member; reconnect with same `clientId` does not duplicate

## Verification

- [ ] Kill API process → clients reconnect and resync (chat, queue, playback position) after restart
- [ ] Close one tab → others see member leave
- [ ] Empty room → keys expire in Redis (`redis-cli KEYS 'room:*'`)
- [ ] Malformed / oversized frames → rejected, server stays up
- [ ] Video end → queue advances exactly once even with 2+ clients reporting
