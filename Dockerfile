# ── Build stage ──
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy package manifests
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

# Build shared first, then server
RUN pnpm --filter @gdgeek/murder-mystery-shared build
RUN pnpm --filter @murder-mystery/server build

# ── Production stage ──
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/dist packages/server/dist

# Copy skill JSON data files (loaded at runtime)
COPY packages/server/src/skills/*.json packages/server/dist/skills/

# Copy DB migrations
COPY packages/server/src/db/migrations packages/server/dist/db/migrations

# Copy routing config
COPY config/ config/

# Copy work log and diary
COPY .kiro/work-log/ .kiro/work-log/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "packages/server/dist/server.js"]
