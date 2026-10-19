# Phase 6 — PWA, sharing & background controls

## Goals

Make the app installable, shareable (OG previews + QR + native share), and usable as a
"keep listening" player. Background audio for a YouTube embed is **not** achievable —
covered under Constraints.

## Tasks

- [x] PWA manifest (`app/manifest.ts`): standalone, theme colors, 192/512 + maskable icons
- [x] Generated icons (`app/icon.tsx`, `app/apple-icon.tsx`, `app/api/icons?size=&maskable=`) via `ImageResponse`
- [x] Root metadata: `metadataBase` (`NEXT_PUBLIC_SITE_URL`, default `http://localhost:3000`), title template, OpenGraph/Twitter defaults, `appleWebApp`, `viewport` theme colors
- [x] Service worker (`public/sw.js`, production-only registration) + `next.config.ts` `/sw.js` no-cache headers; offline shell fallback
- [x] `experimental.useOffline` + `OfflineBanner`
- [x] OG images: root `app/opengraph-image.tsx` + per-room `app/room/[id]/opengraph-image.tsx`; room `generateMetadata`
- [x] Share panel (`components/ShareRoom.tsx`): QR (`qrcode.react`), copy link, `navigator.share` with clipboard fallback
- [x] Media Session (`hooks/useMediaSession.ts`) — OS/lockscreen/headset play/pause/next/prev/seek mapped to WS commands
- [x] Screen Wake Lock (`hooks/useWakeLock.ts`) while playing so phones keep the screen (and audio) on

## Verification

- [x] `turbo run lint typecheck build` green (routes: `/manifest.webmanifest`, `/icon`,
      `/apple-icon`, `/opengraph-image`, `/room/[id]/opengraph-image`, `/api/icons`)
- [x] Served routes return 200 with correct tags: room page emits `og:image` → room OG
      route, `theme-color`, `<link rel="manifest">`, title `Join room {CODE} · music-together`
- [ ] Manual: install prompt + offline banner (needs HTTPS; `next dev --experimental-https`
      or a prod build)
- [ ] Manual: QR scans to `…/room/{CODE}`; native share sheet on a phone

## Constraints / notes

- **No background audio on mobile.** YouTube blocks background playback for non-Premium
  users (intentional, confirmed 2026) and the YouTube Developer Policy forbids developers
  from enabling it (hidden iframes, visibility spoofing). Desktop background tabs keep
  playing; on phones we rely on Wake Lock, not a visibility bypass.
- Service worker only registers in production (`NODE_ENV === "production"`); dev is
  unaffected. Installability needs a secure context — `localhost` qualifies, a LAN IP
  over plain HTTP does not.
- `metadataBase` is required for the relative `openGraph.url` / file-based OG images;
  set `NEXT_PUBLIC_SITE_URL` in real deployments so shared links resolve absolutely.
