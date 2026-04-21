# LLM Gateway — Build Plan

> A multi-tenant LLM proxy with semantic caching, distributed rate limiting, per-tenant cost
> attribution, auto-generated OpenAPI docs, and a usage dashboard.
>
> **Stack:** Turborepo monorepo · Fastify + TypeScript · PostgreSQL (pgvector) · Redis · Next.js 15

---

## What We're Building

A production-grade API gateway that sits in front of LLM providers (OpenAI, Anthropic) and gives
engineering teams:

- **Unified API** — one OpenAI-compatible endpoint regardless of underlying provider
- **Multi-tenancy** — isolated API keys, RBAC, and usage data per tenant
- **Hybrid Key Management** — supports both gateway-owned keys (easy onboarding) and tenant BYOK (enterprise compliance)
- **Cost control** — per-tenant token tracking with dollar-cost attribution stored in Postgres
- **Rate limiting** — Redis-backed sliding window limiter (TPM + RPM) per tenant
- **Semantic caching** — pgvector cosine similarity cache to avoid redundant LLM calls
- **Observability** — structured request/response logs with PII masking before storage
- **API docs** — auto-generated OpenAPI 3.1 spec + Swagger UI from the same Zod schemas used for validation
- **Dashboard** — single-page Next.js usage dashboard showing cost, cache hit rate, and request history

The central architectural wins:
1. **One Zod schema → Fastify validation → OpenAPI spec → TypeScript types in the dashboard**. Zero duplication. End-to-end type safety.
2. **Hybrid key management** — tenants choose between gateway keys (easy) or BYOK (compliance). Automatic fallback.

---

## Monorepo Structure

```
supergate/                            ← repo root
├── apps/
│   ├── gateway/                      ← Fastify API (port 3000)
│   ├── dashboard/                    ← Next.js 15 dashboard (port 3001)
│   └── docs/                         ← Fumadocs documentation site (port 3002)
├── packages/
│   ├── schemas/                      ← Shared Zod schemas (single source of truth)
│   └── sdk/                          ← @supergate/sdk (npm package)
├── nginx/                            ← nginx reverse proxy config
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                      ← root (workspace manager only)
├── docker-compose.yml                ← local dev infrastructure
├── docker-compose.prod.yml           ← full production stack (7 containers)
├── deploy.sh                         ← one-command Droplet deploy
└── plan.md
```

> **Revision (Week 6–7):** `apps/docs` and `packages/sdk` were added to the monorepo. `nginx/`, `docker-compose.prod.yml`, and `deploy.sh` were added for production deployment.

### Why Turborepo + pnpm workspaces

- `packages/schemas` is imported by both `apps/gateway` (validation + OpenAPI) and `apps/dashboard`
  (typed API client responses). One schema definition rules both.
- Turborepo's build cache means `turbo build` only rebuilds what changed. No wasted CI time.
- `pnpm` workspaces handle cross-package symlinks natively. No manual linking.
- The entire project starts with `pnpm install` from root and `turbo dev` — one command.

---

## Full Project Structure

```
supergate/
│
├── apps/
│   │
│   ├── gateway/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts                   ← Fastify app bootstrap + plugin registration
│   │       ├── config.ts                  ← Zod-validated env vars
│   │       │
│   │       ├── db/
│   │       │   ├── client.ts              ← Drizzle + pg pool
│   │       │   ├── schema.ts              ← All table definitions (7 tables)
│   │       │   ├── seed.ts                ← Test data seeder
│   │       │   └── migrations/
│   │       │
│   │       ├── redis/
│   │       │   └── client.ts              ← ioredis singleton
│   │       │
│   │       ├── providers/
│   │       │   ├── types.ts               ← LLMProvider interface
│   │       │   ├── openai.ts              ← 12 models
│   │       │   ├── anthropic.ts           ← 6 models
│   │       │   ├── google.ts              ← 8 models  [added Week 1]
│   │       │   ├── cohere.ts              ← 5 models  [added Week 1]
│   │       │   ├── mistral.ts             ← 20 models [added Week 1]
│   │       │   └── router.ts              ← model → provider + circuit breaker + BYOK
│   │       │
│   │       ├── middleware/
│   │       │   ├── auth.ts                ← unified: API keys + JWT [revised Week 8+]
│   │       │   ├── dashboard-auth.ts      ← JWT-only for user-specific routes [added Week 5a]
│   │       │   ├── rate-limit.ts
│   │       │   ├── pii-mask.ts
│   │       │   ├── semantic-cache.ts
│   │       │   └── usage-logger.ts
│   │       │
│   │       ├── routes/
│   │       │   ├── auth.ts                ← POST /v1/auth/* [added Week 5a]
│   │       │   ├── cache.ts               ← GET /v1/cache/* [added Week 5c]
│   │       │   ├── chat.ts                ← POST /v1/chat/completions
│   │       │   ├── health.ts              ← GET /health
│   │       │   ├── keys.ts                ← CRUD /v1/keys
│   │       │   ├── playground.ts          ← POST /v1/playground/* [added Week 8]
│   │       │   ├── tenant-keys.ts         ← CRUD /v1/tenant/keys
│   │       │   ├── usage.ts               ← GET /v1/usage, /v1/usage/breakdown
│   │       │   ├── usage-chart.ts         ← GET /v1/usage/chart [added Week 5c]
│   │       │   └── usage-logs.ts          ← GET /v1/usage/logs [added Week 5c]
│   │       │
│   │       └── lib/
│   │           ├── cache-cleanup.ts       ← hourly TTL cleanup job
│   │           ├── circuit-breaker.ts
│   │           ├── cost-calculator.ts     ← 51 models with pricing
│   │           ├── embeddings.ts
│   │           ├── encryption.ts          ← AES-256-GCM for BYOK keys
│   │           ├── jwt.ts                 ← token generation/verification [added Week 5a]
│   │           ├── pii-patterns.ts
│   │           └── tenant-keys.ts         ← BYOK key retrieval + fallback logic
│   │
│   ├── dashboard/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx               ← redirects to /landing
│   │       │   ├── globals.css
│   │       │   ├── api-keys/page.tsx      ← gateway API key CRUD [added Week 8+]
│   │       │   ├── keys/page.tsx          ← BYOK key management
│   │       │   ├── landing/page.tsx       ← marketing landing page
│   │       │   ├── login/page.tsx
│   │       │   ├── playground/page.tsx
│   │       │   ├── register/page.tsx
│   │       │   ├── settings/page.tsx
│   │       │   └── usage/page.tsx
│   │       ├── components/
│   │       │   ├── dashboard-layout.tsx
│   │       │   ├── navigation.tsx
│   │       │   ├── protected-route.tsx
│   │       │   └── ui/                    ← badge, button, card, loading-spinner, etc.
│   │       ├── contexts/
│   │       │   └── auth-context.tsx
│   │       └── lib/
│   │           ├── gateway-client.ts      ← typed fetch wrapper (uses @llm-gateway/schemas)
│   │           └── utils.ts
│   │
│   └── docs/                             ← [added Week 7]
│       ├── package.json
│       ├── next.config.mjs
│       ├── source.config.ts
│       └── content/docs/
│           ├── index.mdx, quickstart.mdx, authentication.mdx
│           ├── rate-limiting.mdx, semantic-cache.mdx, providers.mdx
│           └── sdk/  (7 pages)
│
└── packages/
    ├── schemas/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                   ← barrel export
    │       ├── auth.ts                    ← auth schemas [added Week 5a]
    │       ├── cache.ts                   ← cache analytics schemas [added Week 5c]
    │       ├── chat.ts
    │       ├── errors.ts
    │       ├── health.ts
    │       ├── keys.ts
    │       ├── tenant-keys.ts
    │       ├── usage.ts
    │       └── usage-logs.ts              ← paginated logs schema [added Week 5c]
    │
    └── sdk/                              ← [added Week 6]
        ├── package.json
        ├── tsconfig.json
        ├── tsconfig.build.json
        ├── README.md
        ├── CHANGELOG.md
        └── src/
            ├── index.ts
            ├── client.ts
            ├── errors.ts
            ├── types.ts
            └── resources/
                ├── chat.ts, keys.ts, tenant-keys.ts, usage.ts, health.ts
```

---

## The Schemas Package — Single Source of Truth

This is the architectural centrepiece of the monorepo. Every Zod schema lives here, exported once,
used everywhere.

```typescript
// packages/schemas/src/chat.ts
import { z } from 'zod'

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
})

export const ChatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
})

export const ChatResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    message: ChatMessageSchema,
    finish_reason: z.enum(['stop', 'length', 'content_filter']),
  })),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
  'x-cache': z.enum(['HIT', 'MISS']).optional(),
  'x-latency-ms': z.number().optional(),
})

export type ChatRequest  = z.infer<typeof ChatRequestSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>
```

```typescript
// packages/schemas/src/usage.ts
import { z } from 'zod'

export const UsageSummarySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']),
  totalCostUsd: z.number(),
  totalRequests: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  cacheHitRate: z.number().min(0).max(1),
  avgLatencyMs: z.number(),
  days: z.array(z.object({
    date: z.string(),
    costUsd: z.number(),
    requests: z.number(),
    cacheHits: z.number(),
  })),
})

export const UsageBreakdownSchema = z.array(z.object({
  model: z.string(),
  provider: z.string(),
  requests: z.number(),
  costUsd: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
}))

export type UsageSummary   = z.infer<typeof UsageSummarySchema>
export type UsageBreakdown = z.infer<typeof UsageBreakdownSchema>
```

```typescript
// packages/schemas/src/index.ts — barrel export
export * from './chat'
export * from './usage'
export * from './keys'        // Gateway authentication keys
export * from './tenant-keys' // Tenant LLM keys (BYOK)
export * from './health'
```

```json
// packages/schemas/package.json
{
  "name": "@llm-gateway/schemas",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "^3"
  }
}
```

---

## Swagger / OpenAPI Setup (apps/gateway)

Use `fastify-zod-openapi` — it bridges your Zod schemas directly into `@fastify/swagger` without
any manual schema translation. The schemas in `@llm-gateway/schemas` become your OpenAPI spec.

```
pnpm add @fastify/swagger @fastify/swagger-ui fastify-zod-openapi zod-to-json-schema
```

```typescript
// apps/gateway/src/index.ts (swagger registration)
import fastifySwagger    from '@fastify/swagger'
import fastifySwaggerUi  from '@fastify/swagger-ui'
import { zodOpenApiPlugin, createJsonSchemaTransformObject } from 'fastify-zod-openapi'

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'LLM Gateway',
      description: 'Multi-tenant LLM proxy with semantic caching and cost attribution',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer' },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  transform: createJsonSchemaTransformObject({ schemas }),  // auto-registers all Zod schemas
})

await app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list', deepLinking: true },
})
```

```typescript
// apps/gateway/src/routes/chat.ts (route with Zod schema attached)
import { ChatRequestSchema, ChatResponseSchema } from '@llm-gateway/schemas'

app.post('/v1/chat/completions', {
  schema: {
    body: ChatRequestSchema,
    response: { 200: ChatResponseSchema },
    tags: ['Chat'],
    summary: 'Send a chat completion request',
    description: 'OpenAI-compatible endpoint. Supports streaming via SSE.',
  },
}, async (request, reply) => { ... })
```

Swagger UI available at `http://localhost:3000/docs`.
The raw OpenAPI JSON is at `http://localhost:3000/docs/json` — useful for generating
client SDKs later with tools like `openapi-ts` or Speakeasy.

---

## Architecture

The gateway is a composable middleware pipeline. Every request flows through ordered hooks.
Adding a new concern (guardrails, model aliasing, audit logging) is another hook — not a rewrite.

```
Incoming Request
       │
       ▼
┌─────────────────┐
│   Auth Hook     │  Validates API key → attaches tenant context to request
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rate Limit     │  Redis sliding window check (TPM + RPM per tenant)
│  Hook           │  Returns 429 + Retry-After if exceeded
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PII Mask Hook  │  Regex scrub on request body before any logging
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Semantic Cache │  Embed prompt → pgvector similarity search
│  Hook           │  HIT: return cached response, skip provider
└────────┬────────┘  MISS: continue
         │
         ▼
┌─────────────────┐
│  Provider       │  Routes to OpenAIProvider or AnthropicProvider
│  Router         │  Circuit breaker state per provider
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Provider   │  Streaming SSE passthrough via reply.raw
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Usage Logger   │  Writes usage_logs row on onResponse hook
└─────────────────┘
         │
         ▼
  Response to Client


  ┌─────────────────────────────────────────────┐
  │  packages/schemas  (Zod)                    │
  │                                             │
  │  ChatRequestSchema ──► gateway validation   │
  │                    ──► OpenAPI /docs spec   │
  │                    ──► dashboard TS types   │
  └─────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Implementation | Why it matters |
|---|---|---|
| Shared Zod schemas | `packages/schemas` monorepo package | One definition → validation + docs + frontend types |
| Hybrid key management | Gateway keys + tenant BYOK with AES-256-GCM | Serves both startups (easy) and enterprises (compliance) |
| Tenant isolation | Postgres Row Level Security (RLS) | DB-level enforcement; survives ORM bugs |
| Rate limiting | Redis Lua atomic script | No race conditions across replicas |
| Semantic cache | Adaptive cosine threshold by prompt length | Short prompts need tighter threshold |
| SSE streaming | `reply.raw` passthrough | Gateway is transparent to any OpenAI-compatible client |
| Circuit breaker | 3-state per provider (in-process) | Self-healing; documented limitation for multi-replica |

---

## Database Schema

```sql
-- Tenants
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  tier        TEXT NOT NULL DEFAULT 'free',  -- free | pro | enterprise
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- API Keys (hashed — never store raw keys)
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_hash    TEXT NOT NULL UNIQUE,
  key_prefix  TEXT NOT NULL,                 -- first 8 chars: "gw_abc123"
  role        TEXT NOT NULL DEFAULT 'user',  -- admin | user | viewer
  name        TEXT,
  revoked     BOOLEAN DEFAULT false,
  last_used   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Usage Logs
CREATE TABLE usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  api_key_id      UUID REFERENCES api_keys(id),
  provider        TEXT NOT NULL,             -- openai | anthropic
  model           TEXT NOT NULL,
  input_tokens    INTEGER NOT NULL,
  output_tokens   INTEGER NOT NULL,
  cost_usd        NUMERIC(12, 8) NOT NULL,
  latency_ms      INTEGER,
  cached          BOOLEAN DEFAULT false,
  request_id      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX usage_logs_tenant_created  ON usage_logs(tenant_id, created_at DESC);
CREATE INDEX usage_logs_tenant_model    ON usage_logs(tenant_id, model, created_at DESC);

-- Row Level Security
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_logs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON api_keys
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Semantic Cache
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE cache_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  model         TEXT NOT NULL,
  prompt_hash   TEXT NOT NULL,               -- sha256 exact-match fast path
  embedding     vector(1536) NOT NULL,
  response      JSONB NOT NULL,
  hit_count     INTEGER DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- HNSW index: faster than IVFFlat for small-medium sets, no training needed
CREATE INDEX cache_embedding_hnsw ON cache_entries
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX cache_exact_match ON cache_entries(tenant_id, model, prompt_hash);

-- Tenant LLM Keys (BYOK - Bring Your Own Key)
CREATE TABLE tenant_llm_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,             -- openai | anthropic
  api_key_encrypted TEXT NOT NULL,             -- AES-256-GCM encrypted
  iv                TEXT NOT NULL,             -- initialization vector
  is_active         BOOLEAN DEFAULT true,
  last_used         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX tenant_llm_keys_tenant_provider ON tenant_llm_keys(tenant_id, provider, is_active);
```

---

## API Endpoints

### Public (no auth required)

```
GET    /health                    Service health + circuit breaker states
GET    /docs                      Swagger / Scalar API Reference UI
GET    /docs/json                 Raw OpenAPI 3.1 spec
```

### Auth (JWT issued on success)

```
POST   /v1/auth/register          Create user + tenant, return JWT
POST   /v1/auth/login             Verify credentials, return JWT
GET    /v1/auth/me                Get current user info with tenants  [JWT]
PATCH  /v1/auth/profile           Update user profile                 [JWT]
PATCH  /v1/auth/tenant            Update tenant name                  [JWT, admin]
```

### Chat (API key or JWT)

```
POST   /v1/chat/completions       OpenAI-compatible chat (streaming + non-streaming)
```

### Usage & Analytics (API key or JWT)

```
GET    /v1/usage                  Aggregated summary (period=daily|weekly|monthly)
GET    /v1/usage/breakdown        Usage by model + provider
GET    /v1/usage/chart            Pre-bucketed chart data (timeRange=24h|7d|30d)
GET    /v1/usage/logs             Paginated request logs with filters
GET    /v1/cache/stats            Cache hit rate, cost savings, top models
GET    /v1/cache/timeseries       Daily cache performance for charting
```

### Key Management (API key or JWT — admin role required for write)

```
POST   /v1/keys                   Create gateway API key  [admin]
GET    /v1/keys                   List keys — prefix + metadata only  [admin/member/user/viewer]
DELETE /v1/keys/:id               Revoke a key  [admin]
```

### BYOK (API key or JWT — admin role required for write)

```
POST   /v1/tenant/keys            Store provider key (AES-256-GCM encrypted)  [admin]
GET    /v1/tenant/keys            List BYOK keys — masked  [admin/member]
PUT    /v1/tenant/keys/:provider  Rotate a BYOK key  [admin]
DELETE /v1/tenant/keys/:provider  Remove a BYOK key  [admin]
```

### Playground (JWT only)

```
POST   /v1/playground/chat        Non-streaming proxy with full metadata response
GET    /v1/playground/models      Available models with BYOK status per provider
```

> **Revision (Week 5a):** Auth routes added. Usage routes now accept both API keys and JWTs.
> **Revision (Week 5c):** `/v1/usage/chart`, `/v1/usage/logs`, `/v1/cache/*` added.
> **Revision (Week 8):** Playground routes added. `/v1/keys` now accepts JWT (admin JWT = admin role).
> **Revision (unified auth):** All routes now accept both `gw_` API keys and dashboard JWTs via the same `Authorization: Bearer` header. Token type is detected automatically. The original "two separate auth systems" design was superseded.

---

## Environment Variables

```env
# apps/gateway/.env

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/llm_gateway
REDIS_URL=redis://localhost:6379

# Gateway's LLM keys (fallback when tenant doesn't provide their own)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...          # optional
COHERE_API_KEY=...              # optional
MISTRAL_API_KEY=...             # optional

# Encryption for tenant BYOK keys
ENCRYPTION_MASTER_KEY=your-32-character-or-longer-secret-key-here

# JWT secret for dashboard auth
JWT_SECRET=your-jwt-secret-key-at-least-32-characters-long

EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

CACHE_SIMILARITY_THRESHOLD_DEFAULT=0.92
CACHE_SIMILARITY_THRESHOLD_SHORT=0.95
CACHE_TTL_SECONDS=86400

DEFAULT_RPM=60
DEFAULT_TPM=100000

CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RESET_MS=30000

PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# CORS — comma-separated allowed origins (leave unset to allow all)
CORS_ORIGINS=                   # optional, e.g. https://yourdomain.com

# Swagger public URL (shown in API docs in production)
GATEWAY_PUBLIC_URL=             # optional, e.g. https://yourdomain.com
```

```env
# apps/dashboard/.env.local

NEXT_PUBLIC_GATEWAY_URL=http://localhost:3000
```

> **Revision (Week 1):** `GOOGLE_API_KEY`, `COHERE_API_KEY`, `MISTRAL_API_KEY` added (optional — 3 additional providers).
> **Revision (Week 5a):** `JWT_SECRET` added for dashboard authentication.
> **Revision (deployment):** `CORS_ORIGINS` and `GATEWAY_PUBLIC_URL` added for production hardening.

---

## Docker Compose

```yaml
# docker-compose.yml (repo root)
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: llm_gateway
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

---

## Turborepo Config

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// package.json (root)
{
  "name": "llm-gateway",
  "private": true,
  "scripts": {
    "dev":    "turbo dev",
    "build":  "turbo build",
    "test":   "turbo test",
    "lint":   "turbo lint",
    "db:migrate": "pnpm --filter @llm-gateway/gateway db:migrate",
    "db:studio":  "pnpm --filter @llm-gateway/gateway db:studio"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

**One-command start:** `docker compose up -d && turbo dev`
Gateway runs on `:3000`, dashboard on `:3001`.

---

## Package Dependencies

```json
// apps/gateway/package.json
{
  "name": "@llm-gateway/gateway",
  "dependencies": {
    "@llm-gateway/schemas": "workspace:*",
    "fastify": "^5",
    "@fastify/cors": "^9",
    "@fastify/swagger": "^9",
    "@fastify/swagger-ui": "^5",
    "fastify-zod-openapi": "^4",
    "openai": "^4",
    "@anthropic-ai/sdk": "^0.39",
    "drizzle-orm": "^0.40",
    "pg": "^8",
    "ioredis": "^5",
    "zod": "^3",
    "bcryptjs": "^3",
    "jsonwebtoken": "^9",
    "uuid": "^11",
    "dotenv": "^16",
    "@t3-oss/env-core": "^0.12",
    "node-cron": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "tsx": "^4",
    "drizzle-kit": "^0.30",
    "vitest": "^3",
    "@types/pg": "^8",
    "@types/bcryptjs": "^2",
    "@types/jsonwebtoken": "^9",
    "@types/uuid": "^10",
    "@types/node-cron": "^3"
  },
  "scripts": {
    "dev":          "tsx watch src/index.ts",
    "build":        "tsc",
    "test":         "vitest run",
    "db:generate":  "drizzle-kit generate",
    "db:migrate":   "drizzle-kit migrate",
    "db:studio":    "drizzle-kit studio"
  }
}
```

```json
// apps/dashboard/package.json
{
  "name": "@llm-gateway/dashboard",
  "dependencies": {
    "@llm-gateway/schemas": "workspace:*",
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "recharts": "^2",
    "date-fns": "^4",
    "zod": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  },
  "scripts": {
    "dev":   "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001"
  }
}
```

---

## Week-by-Week Build Plan

### Week 0 — Monorepo Foundation (Days 1–3)

**Goal:** Monorepo scaffolded, schemas package building, DB migrated, Fastify starts.

- [x] Init repo: `pnpm init`, `pnpm add -D -w turbo`, create `pnpm-workspace.yaml`
- [x] Scaffold `apps/gateway/`, `apps/dashboard/`, `packages/schemas/` with their own `package.json` + `tsconfig.json`
- [x] Configure `turbo.json` with build dependency order (`schemas` builds before `gateway` and `dashboard`)
- [x] Write all schemas in `packages/schemas/src/` — this is the first real code you write
- [x] `docker-compose.yml` → `docker compose up -d`
- [x] `apps/gateway`: Drizzle schema, run `db:generate` + `db:migrate`
- [x] `apps/gateway`: `src/config.ts` — Zod-validated env, crash on startup if misconfigured
- [x] `apps/gateway`: bare Fastify app, `GET /health` returns 200
- [x] Seed script: create 1 test tenant + 1 API key, print raw key to stdout once
- [x] Verify `turbo dev` starts both apps without errors

**Checkpoint:** `curl localhost:3000/health` → 200. `packages/schemas` builds with `tsc`. ✅

> **Revision:** BYOK encryption (`AES-256-GCM`) and the `tenant_llm_keys` table were added to the initial schema rather than deferred. The `enterprise-independent` tier was also added upfront. Seed script was later expanded to create 4 tenants, 2 users, and 30 days of realistic usage data.

---

### Week 1 — Core Proxy + Streaming (Days 4–10)

**Goal:** Real LLM responses proxy through the gateway end-to-end, including SSE streaming.

- [x] `src/providers/types.ts` — `LLMProvider` interface
- [x] `src/providers/openai.ts` — chat, stream, costPerToken
- [x] `src/providers/anthropic.ts` — same interface, normalized to OpenAI-compatible output
- [x] `src/providers/router.ts` — model → provider mapping + BYOK fallback
- [x] `src/lib/circuit-breaker.ts` — 3-state (CLOSED/OPEN/HALF_OPEN)
- [x] `src/routes/chat.ts` — `POST /v1/chat/completions` (streaming + non-streaming)
- [x] Register Swagger / Scalar API Reference at `/docs`
- [x] Verify streaming works end-to-end

**Checkpoint:** `curl -N` streams tokens in real time. Swagger UI shows the live spec. ✅

> **Revision:** 3 additional providers were implemented beyond the original plan — **Google** (Gemini), **Cohere** (Command), and **Mistral**. Total: 5 providers, 51 models. The `enterprise-independent` tier was added to the provider router: tenants on this tier must supply BYOK keys — no gateway key fallback. Swagger UI was replaced with **Scalar API Reference** (`@scalar/fastify-api-reference`) for a better developer experience.

---

### Week 2 — Auth + Multi-tenancy + Rate Limiting (Days 11–17)

**Goal:** Multiple tenants in isolation. Rate limiting enforced. Only authorized requests get through.

- [x] `src/middleware/auth.ts` — `onRequest` hook: bcrypt API key verification, tenant context, RLS session variable
- [x] `src/middleware/rate-limit.ts` — Redis Lua sliding window (TPM + RPM)
- [x] `src/routes/keys.ts` — admin-only: create, list, revoke gateway API keys
- [x] `src/routes/tenant-keys.ts` — admin-only: store, list, rotate, delete BYOK keys
- [x] Wire middleware in order: `auth → rate-limit → pii-mask → routes → usage-logger`

**Checkpoint:** Two tenants isolated. Rate limit → 429. Revoked key → 401. ✅

> **Revision (Week 8+):** `auth.ts` was later refactored into a **unified middleware** that accepts both `gw_` API keys (bcrypt path) and dashboard JWTs (JWT verify path) in the same `Authorization: Bearer` header. Token type is detected by shape — 3-segment base64url = JWT, `gw_` prefix = API key. Both paths populate `request.tenantContext` with the same shape. This eliminated all per-route hybrid auth wrapper functions. `dashboard-auth.ts` was retained only for user-specific routes (`/v1/auth/*`) that need `userId` from the JWT payload.

---

### Week 3 — PII Masking + Cost Tracking + Usage Endpoint (Days 18–21)

**Goal:** Every request attributed to a tenant with a dollar cost. No PII in storage.

- [x] `src/lib/pii-patterns.ts` — 6 regex patterns (email, phone, SSN, credit card, IP, API keys)
- [x] `src/middleware/pii-mask.ts` — masks before storage, preserves original for LLM call
- [x] `src/lib/cost-calculator.ts` — 51 models with per-token pricing
- [x] `src/middleware/usage-logger.ts` — fire-and-forget `onResponse` hook
- [x] `src/routes/usage.ts` — `GET /v1/usage` and `GET /v1/usage/breakdown`

**Checkpoint:** `/v1/usage` returns accurate cost. PII masked in logs, passed through to provider. ✅

> **Revision (Week 5c):** Two additional usage routes were added — `GET /v1/usage/chart` (pre-bucketed timeseries for dashboard charts) and `GET /v1/usage/logs` (paginated request logs with provider/model/status filters and CSV export). Cache analytics routes `GET /v1/cache/stats` and `GET /v1/cache/timeseries` were also added to showcase the semantic cache as a technical differentiator.

---

### Week 4 — Semantic Cache (Days 22–28)

**Goal:** The technically impressive piece. Duplicate and near-duplicate prompts served from cache.

- [x] `src/lib/embeddings.ts` — OpenAI `text-embedding-3-small` wrapper with request-scoped memoization
- [x] `src/middleware/semantic-cache.ts` — two-stage lookup (exact SHA-256 hash → pgvector cosine similarity)
- [x] Adaptive threshold: 0.95 for prompts < 40 chars, 0.92 for longer
- [x] Cache storage after successful LLM calls with TTL
- [x] `src/lib/cache-cleanup.ts` — hourly `node-cron` job to delete expired entries
- [x] Response headers: `X-Cache: HIT|MISS`, `X-Cache-Type: EXACT|SEMANTIC`, `X-Cache-Similarity`

**Checkpoint:** Same prompt twice → `X-Cache: HIT`. Paraphrased version also hits cache. ✅

> **Revision:** No significant deviations from plan. The HNSW index parameters (`m=16, ef_construction=64`) were chosen over IVFFlat because HNSW requires no training and performs better for small-to-medium dataset sizes. Streaming requests are intentionally not cached (responses are served from the provider in real time).

---

### Week 5 — User Auth + Dashboard Foundation (Days 29–35)

**Goal:** Add user authentication, multi-user tenants, and a proper dashboard with landing page, login/register flows, and role-based access control.

#### Phase 5a: Backend User Auth

- [x] `users` and `user_tenants` tables (many-to-many with roles: admin/member/guest)
- [x] Auth schemas in `packages/schemas/src/auth.ts` (RegisterRequest, LoginRequest, AuthResponse, MeResponse)
- [x] `src/lib/jwt.ts` — token generation (7-day expiry) and verification
- [x] `src/middleware/dashboard-auth.ts` — JWT validation, attaches `userContext`
- [x] `src/routes/auth.ts` — register, login, me, profile update, tenant update
- [x] RBAC: admin / member / guest roles enforced per route

**Checkpoint:** Register -> JWT. Login -> JWT. `/v1/auth/me` returns user + tenant list. ✅

#### Phase 5b: Dashboard Auth UI

- [x] Landing page with hero, feature grid, provider showcase, CTA
- [x] `/login` and `/register` pages with validation and error handling
- [x] `AuthContext` — login, register, logout, session persistence via localStorage
- [x] `ProtectedRoute` wrapper — redirects to `/login` if unauthenticated
- [x] Navigation with user menu (name, tenant, role, tier, logout)

**Checkpoint:** User can register, login, see protected dashboard, logout. ✅

#### Phase 5c: Dashboard Pages + Design System

- [x] **"Architectural Intelligence" design system** — warm espresso/amber palette, Space Grotesk + Manrope typography, no-border rule (surface shifts only)
- [x] **Overview page** — bento grid KPIs, request volume + cache hit charts, recent requests table
- [x] **Usage page** — paginated logs with provider/model/status filters, CSV export
- [x] **Keys page** (`/keys`) — BYOK key management for all 5 providers (add/rotate/remove)
- [x] **Playground page** — model selector, presets, system prompt, parameter sliders, formatted + raw JSON response tabs
- [x] **Settings page** — profile editing, password change, tenant name (admin), danger zone
- [x] **Cache analytics endpoints** — `GET /v1/cache/stats` and `GET /v1/cache/timeseries`

**Checkpoint:** Full dashboard functional. All pages building. Design system applied. ✅

> **Revision:** The original plan described a single "Keys" page for API key management. Implementation split this into two separate pages: `/keys` for BYOK provider keys and `/api-keys` for gateway API keys (added in Week 8+). The "Analytics" page was renamed "Usage" and combined with the logs view. Token storage uses localStorage (not httpOnly cookies) for simplicity. The design system ("The Digital Monolith") was added as a significant scope expansion, giving the dashboard a distinctive premium aesthetic.

---
### Week 6 — SDK (`@supergate/sdk`) (Days 36–40)

**Goal:** Publish `@supergate/sdk` to npm. Full TypeScript, dual CJS/ESM, zero unnecessary runtime deps.

The SDK's value is in the **operational surface** that OpenAI's SDK doesn't cover: key management, BYOK, usage queries, health checks. Chat completions delegate to the OpenAI SDK with the gateway as `baseURL` — so streaming, function calling, and structured outputs all work transparently.

#### Package identity

```
name:    @supergate/sdk
version: 0.1.0
location: packages/sdk
```

#### Structure

```
packages/sdk/
├── package.json
├── tsconfig.json
├── tsconfig.build.json        ← strips test files, targets ESM + CJS dual output
├── README.md
├── CHANGELOG.md
├── .npmignore
└── src/
    ├── index.ts               ← barrel: exports SupergateClient + all types
    ├── client.ts              ← SupergateClient class
    ├── types.ts               ← re-exported types from @llm-gateway/schemas
    ├── errors.ts              ← SupergateError, RateLimitError, AuthError, ProviderError
    └── resources/
        ├── chat.ts            ← client.chat.completions.create() — delegates to OpenAI SDK
        ├── keys.ts            ← client.keys.list/create/revoke()
        ├── tenant-keys.ts     ← client.tenantKeys.list/create/update/remove()
        ├── usage.ts           ← client.usage.getSummary/getBreakdown/getLogs()
        └── health.ts          ← client.health.get()
```

#### Build output

Dual CJS + ESM so the SDK works in Node.js, Bun, Deno, and bundlers:

```
dist/
├── cjs/index.js       ← CommonJS (require)
├── esm/index.js       ← ES Modules (import)
└── types/index.d.ts   ← TypeScript declarations
```

`package.json` exports map:
```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    }
  }
}
```

#### Tasks

- [x] Scaffold `packages/sdk` with `package.json`, `tsconfig.json`, `tsconfig.build.json`
- [x] `src/errors.ts` — `SupergateError`, `RateLimitError`, `AuthError`, `ProviderError`, `ValidationError`
- [x] `src/types.ts` — re-export all relevant types from `@llm-gateway/schemas`
- [x] `src/resources/chat.ts` — thin wrapper that instantiates OpenAI client with gateway baseURL
- [x] `src/resources/keys.ts` — `list()`, `create()`, `revoke()`
- [x] `src/resources/tenant-keys.ts` — `list()`, `create()`, `update()`, `remove()`
- [x] `src/resources/usage.ts` — `getSummary()`, `getBreakdown()`, `getLogs()`
- [x] `src/resources/health.ts` — `get()`
- [x] `src/client.ts` — `SupergateClient` class wiring all resources
- [x] `src/index.ts` — barrel export
- [x] `README.md` — quickstart, full API reference, badge row
- [x] `CHANGELOG.md` — initial entry
- [x] `.npmignore`
- [x] `LICENSE` (MIT)
- [x] `.github/workflows/sdk-publish.yml` — triggers on `packages/sdk/**` changes merged to `main`
- [x] Build verification: `pnpm build` produces `dist/cjs`, `dist/esm`, `dist/types`

**Checkpoint:** `npm pack` produces a clean tarball. Types resolve in a fresh TypeScript project. GitHub Actions workflow ready to publish on merge.

---

### Week 7 — Docs (`apps/docs`) (Days 41–45)

**Goal:** Fumadocs site with quickstart, conceptual guides, and full SDK reference. Every feature has a narrative explanation and a working code example.

#### Stack

- **Fumadocs** (Next.js-based, MDX, fast search, clean dark theme)
- Hosted at `apps/docs`, runs on port 3002
- Content written in MDX, structured by Fumadocs source loader

#### Structure

```
apps/docs/
├── package.json
├── next.config.mjs
├── source.config.ts
└── content/docs/
    ├── meta.json
    ├── index.mdx              ← overview: what Supergate is, architecture pipeline
    ├── quickstart.mdx         ← curl → working request in 60 seconds
    ├── authentication.mdx     ← API keys, BYOK, JWT
    ├── rate-limiting.mdx      ← headers, 429 behavior, Lua atomicity
    ├── semantic-cache.mdx     ← two-stage lookup, adaptive thresholds, cost savings
    ├── providers.mdx          ← supported models, cost per token table
    └── sdk/
        ├── meta.json
        ├── index.mdx          ← SDK overview, installation, initialisation
        ├── chat.mdx           ← chat.completions.create(), streaming
        ├── keys.mdx           ← key management
        ├── tenant-keys.mdx    ← BYOK setup
        ├── usage.mdx          ← usage queries, chart data, logs
        ├── health.mdx         ← health check, circuit breaker states
        └── errors.mdx         ← error hierarchy, error codes
```

#### Tasks

- [x] Scaffold `apps/docs` with Fumadocs + Next.js 15
- [x] Configure `source.config.ts`, `next.config.mjs`, `tailwind.config.ts`
- [x] `src/app/layout.tsx` — RootProvider, Space Grotesk + Manrope fonts
- [x] `src/app/page.tsx` — docs home with Get Started + SDK Reference + GitHub links
- [x] `src/app/docs/layout.tsx` — DocsLayout with nav and sidebar
- [x] `src/app/docs/[[...slug]]/page.tsx` — dynamic MDX page renderer
- [x] `src/lib/source.ts` — Fumadocs source loader
- [x] `src/lib/layout.shared.tsx` — shared nav options (title, links)
- [x] `src/mdx-components.tsx` — MDX component overrides
- [x] Write `index.mdx` — overview, feature table, architecture pipeline, quick links
- [x] Write `quickstart.mdx` — infra setup, seed, first curl, response headers, SDK snippet
- [x] Write `authentication.mdx` — gateway keys, BYOK, JWT, tier behavior table
- [x] Write `rate-limiting.mdx` — headers, 429 shape, token estimation, Lua script, SDK handling
- [x] Write `semantic-cache.mdx` — two-stage lookup, adaptive thresholds, headers, TTL, limitations
- [x] Write `providers.mdx` — all 5 providers, model tables, circuit breaker states
- [x] Write `sdk/index.mdx` — installation, initialisation options, resource table
- [x] Write `sdk/chat.mdx` — non-streaming, streaming, system prompt, response headers
- [x] Write `sdk/keys.mdx` — list, create, revoke, types
- [x] Write `sdk/tenant-keys.mdx` — list, add, rotate, remove, types
- [x] Write `sdk/usage.mdx` — summary, breakdown, chart data, logs with filters
- [x] Write `sdk/health.mdx` — health check, response shape, circuit breaker states
- [x] Write `sdk/errors.mdx` — error hierarchy, usage pattern, all error codes
- [x] Fix fumadocs-ui v14 compatibility (provider import, CSS imports, collections path)
- [x] Verify `pnpm build` produces all 13 pages as static HTML

**Checkpoint:** Docs site builds clean. All 13 pages render. Every SDK method has a working code example.

---

### Week 8 — Playground + Final Polish (Days 46–52)

**Goal:** Complete the playground feature and polish the entire application for demo readiness.

#### Playground Backend

- [x] **Playground Schema** (`packages/schemas/src/playground.ts`):
  ```typescript
  export const PlaygroundRequestSchema = z.object({
    model: z.string(),
    messages: z.array(ChatMessageSchema),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().optional(),
    systemPrompt: z.string().optional(),
  })
  ```
- [x] **Playground Route** (`src/routes/playground.ts`):
  - `POST /v1/playground/chat` — non-streaming proxy with full metadata response
  - `GET /v1/playground/models` — curated model list with BYOK status per provider
  - Requires dashboard JWT auth (not API key)
  - Returns `{ requestId, response, meta: { latencyMs, costUsd, cached, provider, model, inputTokens, outputTokens } }`
  - Respects enterprise-independent tier (BYOK-only)

#### Playground UI

- [x] **Model Selector** — grouped by provider, shows BYOK badge, enterprise-independent filtering
- [x] **Preset System** — 5 presets (Code Reviewer, Explain Simply, Socratic Tutor, JSON Extractor)
- [x] **System Prompt** — editable with token estimate
- [x] **Message Input** — Cmd+Enter to run, token estimate
- [x] **Response Viewer** — Formatted (markdown rendered) + Raw JSON tabs, copy button
- [x] **Metadata Footer** — latency, cost, cache status, token counts
- [x] **Parameter Controls** — temperature slider (0–2), max tokens slider (256–8192)
- [x] **Reset Button** — clears all state

#### Dashboard Polish

- [x] **Settings Page** — profile editing, password change, tenant name (admin), danger zone
- [x] **Keys Page** — BYOK key management for all 5 providers, add/rotate/remove modals
- [x] **Navigation** — mobile hamburger, user menu with tenant/role/tier info, settings link
- [x] **All 9 routes building** — landing, login, register, overview, usage, keys, playground, settings, 404

**Checkpoint:** Full application demo-ready. All pages functional. Playground sends real requests and shows metadata. Settings and key management work end-to-end.

---

## Implementation Details

### The LLMProvider Interface

```typescript
// apps/gateway/src/providers/types.ts
export interface LLMProvider {
  id: 'openai' | 'anthropic'
  chat(req: ChatRequest): Promise<ChatResponse>
  stream(req: ChatRequest): AsyncIterable<StreamChunk>
  modelsSupported(): string[]
  costPerToken(model: string): { inputUsd: number; outputUsd: number }
}
```

### Redis Rate Limiter Key Schema

```
rl:{tenantId}:tpm:{Math.floor(Date.now() / 60000)}   → running token count this minute
rl:{tenantId}:rpm:{Math.floor(Date.now() / 60000)}   → running request count this minute
```

Both keys expire after 60 seconds. `PEXPIRE` is only set when `INCR` returns 1 (first write
of the window) so concurrent writes don't reset the expiry.

### Circuit Breaker State Machine

```
                   ┌─────────────────────────────────────────┐
                   │                                         │
        failures   │              reset timer                │
 CLOSED ──────────► OPEN ──────────────────────────► HALF_OPEN
   ▲                                                    │   │
   │                                    success         │   │  failure
   └────────────────────────────────────────────────────┘   │
                                                            ▼
                                                          OPEN
```

State stored in module-level memory (single process). Documented in README as a known
limitation for multi-replica deployments (Redis-backed state would be the fix).

### Semantic Cache Threshold Rationale

| Prompt type | Length | Threshold | Reason |
|---|---|---|---|
| Short | < 40 chars | 0.95 | Small edits ("What is X?" vs "Define X") shift intent significantly |
| Medium | 40–200 chars | 0.92 | More context stabilizes semantic meaning |
| Long | > 200 chars | 0.90 | Paraphrasing unlikely to change the core question |

Document this table in your README under "Tradeoffs" — it signals you understand *why* the
problem is hard, not just that it exists.

---

## What to Leave for Later / Mention in README

| Feature | Note for README |
|---|---|
| Fallback chains | "Automatic fallback chains planned — circuit breaker handles single-provider failure today" |
| Model aliasing | "`fast` → `gpt-4o-mini` alias config planned" |
| Spend alerts | "Per-tenant budget alerts with webhook delivery planned" |
| Per-model cache threshold | "Cache threshold is global; per-model tuning is a roadmap item" |
| Distributed circuit breaker | "Circuit breaker state is in-process; Redis-backed for horizontal scaling planned" |
| Real-time dashboard | "Dashboard polls every 30s; WebSocket streaming planned" |
| OTEL traces | "OpenTelemetry instrumentation planned for distributed tracing (Jaeger/Honeycomb)" |

---

## README Checklist

- [ ] One paragraph: what this is and why it exists
- [ ] Architecture pipeline diagram
- [ ] Monorepo structure overview
- [ ] Local setup: `git clone → docker compose up -d → pnpm install → pnpm db:migrate → turbo dev`
- [ ] Quick start: seed tenant → create key → curl example → open dashboard
- [ ] Screenshot of dashboard (take one when done)
- [ ] Screenshot of Swagger UI (take one when done)
- [ ] API reference table
- [ ] **Tradeoffs & Limitations** (write this yourself — interviewers notice)
- [ ] **How I'd scale this** section
- [ ] **What I'd add next** section

---

## Milestones

| End of | Shippable state |
|---|---|
| Week 0 | Monorepo starts, schemas package builds, DB migrated, `/health` returns 200 |
| Week 1 | Real LLM responses proxy through the gateway; streaming works; `/docs` shows Scalar API Reference |
| Week 2 | Two tenants isolated; rate limiting enforced; API key management live |
| Week 3 | Cost attribution in Postgres; `/v1/usage` returns real dollar figures |
| Week 4 | Semantic cache live; `X-Cache: HIT` on duplicate prompts; 294 tests passing |
| Week 5 | User auth + dashboard with landing page, login, protected routes, design system, all pages |
| Week 6 | `@supergate/sdk` published to npm; dual CJS/ESM; GitHub Actions publish workflow |
| Week 7 | Fumadocs docs site live; 17 pages; full SDK reference; builds clean |
| Week 8 | Playground, API keys dashboard page, settings, BYOK management; all 10 dashboard routes building |
| Deployment | Docker Compose production stack; nginx reverse proxy; SSL; one-command Droplet deploy |

Total: **~8 weeks + deployment** for a project covering backend architecture, distributed systems, monorepo tooling, API design, authentication, RBAC, unified auth middleware, SDK publishing, documentation, and full-stack delivery.

---

## Interview Talking Points

**"Walk me through the architecture."**
→ Lead with the pipeline: "Every request flows through six ordered middleware hooks — auth, rate
limiting, PII masking, semantic cache check, provider call, and usage logging. Each hook is
independent and tested in isolation. Adding guardrails is another hook in the chain, not a rewrite.
The schemas are defined once in a shared package and drive validation, OpenAPI docs, and dashboard
type safety simultaneously."

**"How does the Swagger documentation stay in sync?"**
→ "It can't go out of sync. The Zod schemas in the shared package are the source of truth. When
the gateway uses them for request validation via `fastify-zod-openapi`, the OpenAPI spec is
generated from the same objects. When the dashboard imports them for typed API client responses,
TypeScript errors at build time if the gateway changes a field shape."

**"How does the semantic cache actually work?"**
→ "Two-stage lookup. First, a sha256 hash of the exact prompt against an indexed column — zero
vector math if it's an identical request. If that misses, I embed the prompt using
text-embedding-3-small, run a cosine similarity query against a pgvector HNSW index, and compare
against an adaptive threshold. Shorter prompts use a tighter threshold because 'What is Redis?'
and 'Define Redis' are different enough to potentially want different responses, but a 200-word
context + question is stable enough to cache with more tolerance."

**"Why Redis for rate limiting?"**
→ "A database counter has a race condition — two concurrent requests read the same count, both
increment, both succeed when one should be blocked. A Redis Lua script makes check-and-increment
atomic in a single round trip. No race condition regardless of concurrent requests or gateway
replicas."

**"How do you ensure tenant data isolation?"**
→ "Two layers. Application layer: every query includes `tenant_id`. Database layer: Postgres RLS
policies filter automatically based on a session variable set per request. Even if the ORM
generates a query without the WHERE clause, the database won't return another tenant's rows. It's
defense in depth — both layers have to fail simultaneously for a data leak to occur."

**"What would you change for 1000 tenants at scale?"**
→ "The circuit breaker state is in-process — needs Redis for multi-replica. The HNSW index
parameters need tuning as the cache grows. I'd add per-model cache threshold configuration instead
of global defaults, read replicas for usage queries, and move cost aggregation to a background job
(BullMQ) instead of synchronous inserts on the hot path."

---

## AI Assistance Guidelines

- **Scaffold, boilerplate, Zod schemas** → prompt freely, review all output
- **Write these yourself first, then ask AI to review:**
  - The Redis Lua script (understand the atomicity argument)
  - The circuit breaker state machine (you'll be asked to whiteboard it)
  - The pgvector query and threshold logic (adaptive threshold is your story)
  - The `packages/schemas` design (you'll be asked why this structure)
- **Tests** → write the test cases yourself; let AI fill in Vitest syntax
- **README Tradeoffs section** → write this entirely yourself
- **Dashboard** → AI can write most of it; understand the gateway-client type flow

The rule: if you can't explain why the code works in an interview, don't ship it as yours.
The Redis Lua atomicity, RLS enforcement, HNSW index, and shared schema chain are your four
conversational moments. Own those four pieces completely.


---

## SDK — `packages/sdk` (`@supergate/sdk`)

### Why

The gateway exposes an OpenAI-compatible `/v1/chat/completions` endpoint, so any existing OpenAI
SDK already works against it by changing `baseURL`. The SDK's value is in the **operational
surface** that OpenAI's SDK doesn't cover: key management, BYOK, usage queries, health checks.

The SDK is a thin, typed wrapper that:
1. Re-exports the OpenAI client pre-configured with the gateway URL
2. Adds typed methods for every gateway-specific endpoint
3. Ships types derived directly from `packages/schemas` — zero duplication

### Package identity

```
name:    @supergate/sdk
version: 0.1.0
license: MIT
```

Published to npm. Source lives in `packages/sdk` inside the monorepo.

### Structure

```
packages/sdk/
├── package.json
├── tsconfig.json
├── tsconfig.build.json        ← strips test files, targets ESM + CJS dual output
├── README.md                  ← npm landing page
├── CHANGELOG.md
├── .npmignore
└── src/
    ├── index.ts               ← barrel: exports SupergateClient + all types
    ├── client.ts              ← SupergateClient class
    ├── types.ts               ← re-exported types from @llm-gateway/schemas
    ├── errors.ts              ← SupergateError, RateLimitError, AuthError
    └── resources/
        ├── chat.ts            ← client.chat.completions.create() — delegates to OpenAI SDK
        ├── keys.ts            ← client.keys.list/create/revoke()
        ├── tenant-keys.ts     ← client.tenantKeys.list/create/update/remove()
        ├── usage.ts           ← client.usage.getSummary/getBreakdown/getLogs()
        └── health.ts          ← client.health.get()
```

### API surface

```typescript
import { SupergateClient } from '@supergate/sdk'

const client = new SupergateClient({
  apiKey:  'gw_...',
  baseUrl: 'https://your-gateway.com',  // defaults to http://localhost:3000
})

// ── Chat (OpenAI-compatible) ─────────────────────────────────────────────────
const response = await client.chat.completions.create({
  model:    'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
})

// Streaming
const stream = await client.chat.completions.create({
  model:    'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  stream:   true,
})
for await (const chunk of stream) { process.stdout.write(chunk.choices[0]?.delta?.content ?? '') }

// ── Keys ─────────────────────────────────────────────────────────────────────
const keys   = await client.keys.list()
const newKey = await client.keys.create({ name: 'prod', role: 'user' })
await client.keys.revoke(newKey.id)

// ── BYOK ─────────────────────────────────────────────────────────────────────
await client.tenantKeys.create({ provider: 'openai', apiKey: 'sk-...' })
const byok = await client.tenantKeys.list()
await client.tenantKeys.remove('openai')

// ── Usage ─────────────────────────────────────────────────────────────────────
const summary   = await client.usage.getSummary({ period: 'weekly' })
const breakdown = await client.usage.getBreakdown({ period: 'weekly' })
const logs      = await client.usage.getLogs({ timeRange: '7d', provider: 'openai' })

// ── Health ────────────────────────────────────────────────────────────────────
const health = await client.health.get()
```

### Build output

Dual CJS + ESM output so the SDK works in Node.js, Bun, Deno, and bundlers:

```
dist/
├── cjs/index.js       ← CommonJS (require)
├── esm/index.js       ← ES Modules (import)
└── types/index.d.ts   ← TypeScript declarations
```

`package.json` exports map:
```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    }
  }
}
```

### Dependencies

- `openai` — peer dependency (user brings their own version, SDK delegates chat to it)
- `zod` — peer dependency (shared with gateway)
- No other runtime dependencies

### GitHub readiness

- `README.md` with quickstart, full API reference, and badge row
- `CHANGELOG.md` following Keep a Changelog format
- `.npmignore` excluding src, tests, tsconfig
- `LICENSE` (MIT)
- GitHub Actions workflow: `.github/workflows/sdk-publish.yml`
  - Triggers on `packages/sdk/**` changes merged to `main`
  - Runs `pnpm build` + `pnpm test`
  - Publishes to npm with `NPM_TOKEN` secret

---

## Docs — `apps/docs`

### Why

The gateway already generates OpenAPI 3.1 at `/docs/json`. That's the machine-readable contract.
The docs site is the human-readable layer on top: narrative, examples, conceptual explanations.

### Stack

- **Fumadocs** (Next.js-based, MDX, fast search, clean dark theme)
- Hosted at `apps/docs`, runs on port 3002
- Pulls the live OpenAPI spec from the gateway to render the API reference section

### Structure

```
apps/docs/
├── package.json
├── next.config.ts
└── content/
    ├── index.mdx                  ← landing / overview
    ├── quickstart.mdx             ← curl → working request in 60 seconds
    ├── authentication.mdx         ← API keys, BYOK, JWT
    ├── rate-limiting.mdx          ← headers, 429 behavior, limits by tier
    ├── semantic-cache.mdx         ← how it works, thresholds, cost savings
    ├── providers.mdx              ← supported models, cost table
    ├── sdk/
    │   ├── index.mdx              ← SDK overview
    │   ├── quickstart.mdx         ← install + first request
    │   ├── chat.mdx               ← chat.completions.create()
    │   ├── keys.mdx               ← key management
    │   ├── usage.mdx              ← usage queries
    │   └── byok.mdx               ← BYOK setup
    └── api-reference/             ← generated from OpenAPI spec
        └── [slug].mdx
```

### Content plan

Each page follows: **What it is → Why it matters → How to use it → Code example**.

The SDK pages show both the raw HTTP call and the SDK equivalent side by side.

---

## Updated Monorepo Structure

```
llm-gateway/
├── apps/
│   ├── gateway/          ← Fastify API
│   ├── dashboard/        ← Next.js dashboard (port 3001)
│   └── docs/             ← Fumadocs documentation site (port 3002)
├── packages/
│   ├── schemas/          ← Shared Zod schemas (single source of truth)
│   └── sdk/              ← @supergate/sdk (npm package)
├── .github/
│   └── workflows/
│       └── sdk-publish.yml
└── ...
```


