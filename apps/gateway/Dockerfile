# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/schemas/package.json ./packages/schemas/
COPY apps/gateway/package.json ./apps/gateway/

# Install all workspace deps (needed to resolve workspace:* links)
RUN pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/schemas/node_module[s] ./packages/schemas/node_modules
COPY --from=deps /app/apps/gateway/node_module[s] ./apps/gateway/node_modules

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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace manifests for production install
COPY --chown=appuser:nodejs package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=appuser:nodejs packages/schemas/package.json ./packages/schemas/
COPY --chown=appuser:nodejs apps/gateway/package.json ./apps/gateway/

# Production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder --chown=appuser:nodejs /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder --chown=appuser:nodejs /app/apps/gateway/dist ./apps/gateway/dist

# Copy migrations (needed at runtime for db:migrate)
COPY --chown=appuser:nodejs apps/gateway/drizzle ./apps/gateway/drizzle
COPY --chown=appuser:nodejs apps/gateway/drizzle.config.ts ./apps/gateway/

WORKDIR /app/apps/gateway

USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
