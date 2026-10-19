# Phase 5 — Search + quality gate + docs

## Goals

Track search convenience, all quality commands green via turbo, docs that a fresh
clone can follow.

## Tasks

- [ ] Web: search box in queue panel — try keyless `youtube-sr` first; keep paste-URL as fallback; swap to YouTube Data API v3 (env API key) if the keyless lib breaks
- [ ] Wire `typecheck` (`tsc --noEmit`) into both apps + turbo task
- [ ] API tests: Jest unit tests for room/playback state logic + e2e (`test:e2e`) for REST + WS join flow
- [ ] Root README: setup (Laragon Redis prerequisite), run commands, single-test commands
- [ ] Reconcile root `AGENTS.md` with reality (commands, gotchas, layout)

## Verification

- [ ] `turbo run lint typecheck test build` all green
- [ ] Search → click result → track lands in queue and syncs
- [ ] Fresh-clone path: install → start Redis → `npm run dev` → create room works
