# Phase 2 — Chat

## Goals

Room members exchange messages; history persists in Redis and is restored on join.

## Tasks

- [ ] API: `chat:send` handler — zod validation (max 500 chars), rate limit (~5 msg / 10 s per socket)
- [ ] API: persist to `room:{id}:chat` (RPUSH + LTRIM 100); include last 100 in `joined` snapshot
- [ ] API: broadcast `chat:new { id, clientId, name, text, at }`
- [ ] Web: minimal chat panel (message list + input) on room page; render history from snapshot

## Protocol additions

`chat:send { text }` → `chat:new { msg }`; `error { code: 'RATE_LIMITED' | 'INVALID', ... }`

## Verification

- [ ] Two clients exchange messages in real time
- [ ] Late joiner sees the last messages
- [ ] Restart API → history still present (Redis)
- [ ] Over-long / rapid messages rejected without server crash
