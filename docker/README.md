# Docker deployment

This setup provides multi-stage Dockerfiles for both apps.

## Build API image

```bash
docker build -f docker/api.Dockerfile -t music-together-api .
```

## Build Web image

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://yourdomain.com \
  -f docker/web.Dockerfile -t music-together-web .
```

## Run (example)

API needs Redis reachable at `REDIS_URL` (e.g. `redis://host.docker.internal:6379` or internal network). Set env vars as needed:

- API: `PORT=3001`, `REDIS_URL`, `WEB_ORIGIN` (web origin for CORS)
- Web: `NEXT_PUBLIC_*` are baked at build time

```bash
docker run --rm -p 3001:3001 \
  -e PORT=3001 \
  -e REDIS_URL=redis://redis:6379 \
  -e WEB_ORIGIN=https://yourdomain.com \
  music-together-api

docker run --rm -p 3000:3000 \
  music-together-web
```

Both images use multi-stage builds for minimal size and run as non-root users.
