# Phase 2 — Chat

## Goals

Room members exchange messages; history persists in Redis and is restored on join.

## Tasks

- [x] API: `chat:send` handler — zod validation (max 500 chars), rate limit (~5 msg / 10 s per socket)
- [x] API: persist to `room:{id}:chat` (RPUSH + LTRIM 100); include last 100 in `joined` snapshot
- [x] API: broadcast `chat:new { id, clientId, name, text, at }`
- [x] Web: minimal chat panel (message list + input) on room page; render history from snapshot

## Protocol additions

`chat:send { text }` → `chat:new { msg }`; `error { code: 'RATE_LIMITED' | 'INVALID', ... }`

## Verification

- [x] Two clients exchange messages in real time (`node scripts/chat-smoke.mjs`)
- [x] Late joiner sees the last messages
- [x] Restart API → history still present (Redis) (`node scripts/history-check.mjs write|read`)
- [x] Over-long / rapid messages rejected without server crash
