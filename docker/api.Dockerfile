
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build NestJS from its own workspace directory
RUN cd apps/api && node ../../node_modules/@nestjs/cli/bin/nest.js build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/apps/api/dist ./dist
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app apps/api/package.json ./package.json

USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
