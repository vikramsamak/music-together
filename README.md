# music-together

Listen to YouTube together. Create a room, share the code, and everyone gets a synced
player, a shared queue, and chat — any member can control playback.

- `apps/api` — NestJS 11 + socket.io gateway + Redis (port 3001)
- `apps/web` — Next.js 16 + React 19 + Tailwind 4 (port 3000)

Realtime lives in the NestJS gateway because stable Next.js 16 has no WebSocket API.
See [`docs/plans/README.md`](docs/plans/README.md) for the architecture and WS protocol,
and [`docs/plans/`](docs/plans) for the phase-by-phase build plan.

## Prerequisites

- Node.js 22+ and npm 11 (`npm install -g npm@11`)
- Redis reachable at `redis://127.0.0.1:6379` — on Windows, [Laragon](https://laragon.org/)
  ships one; start it before running the API. Redis is required: room create/join fails
  without it.

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env.local   # PowerShell: Copy-Item apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
```

`apps/api/.env.local`:

```
PORT=3001
REDIS_URL=redis://127.0.0.1:6379
WEB_ORIGIN=http://localhost:3000
```

`apps/web/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The API loads `.env.local` then `.env` (first match wins) and validates these vars at
startup. Both `.env.local` files are gitignored; the `.env.example` files are the committed
templates.

## Run

```bash
npm run dev              # both apps via turbo
npm run dev -w api       # api only (nest start --watch)
npm run dev -w web       # web only (next dev)
```

Open http://localhost:3000, create a room, then open the room URL in a second tab or
another browser and paste the room code.

Note: browsers block audio until a user gesture, so a freshly queued track starts paused —
press Play once in each tab.

## PWA & sharing

The web app is installable (manifest + generated icons + a production-only service worker)
and shows an offline banner when the connection drops.

- Install / service worker only run in a production build on a secure context:
  `npm run build && npm run start -w web` (then install from the browser). A LAN IP over
  plain HTTP is not a secure context — use `next dev --experimental-https` to test on a phone.
- Every room link renders an OG preview (`/room/{CODE}/opengraph-image`); the room header's
  **Share** button shows a QR code, copies the link, or opens the native share sheet.
- **Background audio:** the YouTube embed cannot play in the background on mobile — YouTube
  blocks it for non-Premium users and their developer policy forbids bypassing it. On phones
  the app holds a screen Wake Lock while playing; desktop background tabs keep playing.
- Set `NEXT_PUBLIC_SITE_URL` (e.g. `https://music.example`) in production so shared links and
  OG images use absolute URLs.

## Quality checks

```bash
npm run lint                     # turbo: eslint, both apps
npx turbo run typecheck          # turbo: tsc --noEmit, both apps
npm run build                    # turbo: nest build + next build
npm run test -w api              # jest unit tests
npm run test:e2e -w api          # jest e2e (REST create + WS join; needs Redis)
```

## Smoke tests

Start the API first (`npm run dev -w api`), then:

```bash
node scripts/ws-smoke.mjs          # presence
node scripts/chat-smoke.mjs        # chat exchange, history, rate limit
node scripts/playback-smoke.mjs    # queue + server-authoritative playback
node scripts/robustness-smoke.mjs  # malformed frames, caps, TTLs, ENDED-once
node scripts/history-check.mjs write   # then restart the api, then:
node scripts/history-check.mjs read <roomId>
node scripts/restart-smoke.mjs     # manages its own api on :3005; kill/restart resync
```

Search can be checked directly:

```bash
curl "http://localhost:3001/api/search?q=daft+punk"
```

## How sync works

1. Any client sends a command (`player:play`, `player:seek`, `queue:add`, ...).
2. The API applies it to the room's Redis state, bumps `version`, and broadcasts
   `playback:update { state, senderId, now }`.
3. Clients apply the state idempotently and run a drift-correction loop every 5 s:
   if the local player is more than 2 s off the server-computed position, it seeks.
4. `version` guards stale commands, and a per-room lock serializes concurrent commands
   so a double `ENDED` report advances the queue exactly once.
