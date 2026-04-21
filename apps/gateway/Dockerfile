# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/schemas/package.json ./packages/schemas/
COPY apps/gateway/package.json ./apps/gateway/

# Install all workspace deps (needed to resolve workspace:* links)
RUN pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/schemas/node_modules ./packages/schemas/node_modules 2>/dev/null || true
COPY --from=deps /app/apps/gateway/node_modules ./apps/gateway/node_modules 2>/dev/null || true

# Copy source
COPY packages/schemas ./packages/schemas
COPY apps/gateway ./apps/gateway
COPY turbo.json ./

# Build schemas first, then gateway
RUN pnpm --filter @llm-gateway/schemas build
RUN pnpm --filter @llm-gateway/gateway build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests for production install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/schemas/package.json ./packages/schemas/
COPY apps/gateway/package.json ./apps/gateway/

# Production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist

# Copy migrations (needed at runtime for db:migrate)
COPY apps/gateway/drizzle ./apps/gateway/drizzle
COPY apps/gateway/drizzle.config.ts ./apps/gateway/

WORKDIR /app/apps/gateway

EXPOSE 3000

CMD ["node", "dist/index.js"]
