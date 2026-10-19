# Phase 1 — Monorepo foundation + room/presence connection

## Goals

Working `npm run dev` for both apps from the root, single git repo, rooms creatable
over REST, users join via WS and see each other in a member list.

## Tasks

- [ ] Root: add `workspaces: ["apps/*"]`, create `turbo.json` (`dev` persistent, `build` dependsOn `^build`, `lint`, `test`), fix recursive `turbo dev` loop
- [ ] Git: remove `apps/api/.git` + `apps/web/.git`, `git init` at root, root `.gitignore` (`node_modules/`, `.next/`, `dist/`, `.turbo/`, `.env`)
- [ ] Dedupe lockfiles: delete nested `package-lock.json`s, root `npm install`
- [ ] API: install `@nestjs/websockets @nestjs/platform-socket.io socket.io ioredis @nestjs/config`; port 3001; `.env` + `.env.example` (`PORT`, `REDIS_URL`, `WEB_ORIGIN`)
- [ ] API: `POST /api/rooms` → 6-char room ID stored in Redis (`room:{id}`)
- [ ] API: `RoomGateway` — `join` handler (validate room, `socket.join`, presence map), `handleDisconnect`, emit `presence:update` + reply `joined`
- [ ] Web: install `socket.io-client`; `lib/name.ts` (localStorage + `Guest-XXXX`), `lib/clientId.ts` (persisted uuid)
- [ ] Web: home page (create room / join by ID) and `/room/[id]` page with member list + connection status (unstyled)

## Verification

- [x] `npx turbo run dev --dry` completes without recursion error
- [x] `POST http://localhost:3001/api/rooms` returns a roomId
- [x] Two WS clients joining the same room both receive `presence:update` with 2 members (`node scripts/ws-smoke.mjs`)
- [x] `turbo run build lint` passes

## Notes

- Room exists = `room:{id}` key exists (created by REST, no auto-create on WS join).
- Presence is in-memory (single API instance) — survives reconnects via `clientId` in Phase 4.
