# Phase 5 — Search + quality gate + docs

## Goals

Track search convenience, all quality commands green via turbo, docs that a fresh
clone can follow.

## Tasks

- [x] Web: search box in queue panel — keyless `youtube-sr` via `GET /api/search`; paste-URL kept as fallback (API returns 503 when the scraper is blocked)
- [x] Wire `typecheck` (`tsc --noEmit`) into both apps + turbo task (web runs `next typegen` first)
- [x] API tests: Jest unit tests for room/playback state logic + e2e (`test:e2e`) for REST + WS join flow
- [x] Root README: setup (Laragon Redis prerequisite), run commands, single-test commands
- [x] Reconcile root `AGENTS.md` with reality (commands, gotchas, layout)

## Verification

- [x] `turbo run lint typecheck test build` all green
- [x] Search → click result → track lands in queue and syncs (`GET /api/search` verified; adding uses the same `queue:add` path as paste)
- [x] Fresh-clone path: install → start Redis → `npm run dev` → create room works (documented in root README)
