# LLM Gateway

> A production-grade, multi-tenant API gateway for large language model providers with semantic caching, distributed rate limiting, and cost attribution.

**Stack:** Turborepo monorepo · Fastify + TypeScript · PostgreSQL (pgvector) · Redis · Next.js 15

---

## What This Is

An interview-quality LLM Gateway that demonstrates production architecture patterns:

- **Unified API** — OpenAI-compatible endpoint regardless of underlying provider (OpenAI, Anthropic)
- **Multi-tenancy** — Isolated API keys, RBAC, and usage data per tenant with PostgreSQL Row Level Security
- **Hybrid Key Management** — Supports both gateway-owned keys (easy onboarding) and tenant BYOK (enterprise compliance)
- **Cost control** — Per-tenant token tracking with dollar-cost attribution
- **Rate limiting** — Redis-backed atomic sliding window limiter (TPM + RPM) per tenant
- **Semantic caching** — pgvector cosine similarity cache with adaptive thresholds
- **Observability** — Structured request/response logs with PII masking, auto-generated OpenAPI docs
- **Dashboard** — Next.js usage dashboard showing cost, cache hit rate, and request history

**The architectural win:** One Zod schema → Fastify validation → OpenAPI spec → TypeScript types in the dashboard. Zero duplication. End-to-end type safety.

---

## Project Structure

```
llm-gateway/
├── apps/
│   ├── gateway/          # Fastify API gateway
│   └── dashboard/        # Next.js 15 dashboard
├── packages/
│   └── schemas/          # Shared Zod schemas (single source of truth)
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.yml
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# 3. Configure environment
cp apps/gateway/.env.example apps/gateway/.env
# Edit apps/gateway/.env and add your OpenAI and Anthropic API keys

cp apps/dashboard/.env.example apps/dashboard/.env.local

# 4. Run database migrations
pnpm db:migrate

# 5. Seed test data (creates tenant + API key)
pnpm --filter @llm-gateway/gateway db:seed
# ⚠️ Save the API key printed to console - it won't be shown again!

# 6. Start development servers
pnpm dev
```

**Gateway:** http://localhost:3000  
**Dashboard:** http://localhost:3001

For detailed setup instructions, see [SETUP.md](./SETUP.md).

---

## API Documentation

Once the gateway is running, visit:

- **Swagger UI:** http://localhost:3000/docs
- **OpenAPI JSON:** http://localhost:3000/docs/json

---

## Current Status

**Phase:** Week 0 - Monorepo Foundation ✅

See [roadmap-status.md](./roadmap-status.md) for detailed progress tracking.

---

## Architecture Highlights

### Hybrid Key Management (Gateway + BYOK)

The gateway supports **both** gateway-owned keys and tenant BYOK:

```typescript
// Automatic fallback logic
const tenantKey = await getTenantLLMKey(tenantId, 'openai')

if (tenantKey) {
  // Use tenant's key (BYOK) - enterprise compliance
  client = new OpenAI({ apiKey: tenantKey })
} else {
  // Use gateway's key - easy onboarding
  client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
}
```

**Benefits:**
- ✅ Startups get easy onboarding (no OpenAI account needed)
- ✅ Enterprises get compliance (BYOK with AES-256-GCM encryption)
- ✅ Tenants can switch between modes anytime

See [HYBRID-BYOK.md](./HYBRID-BYOK.md) for details.

### Shared Schema Architecture

The `packages/schemas` package is the architectural centerpiece:

```typescript
// Define once in packages/schemas/src/chat.ts
export const ChatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(ChatMessageSchema),
  // ...
})

// Used in gateway for validation
app.post('/v1/chat/completions', {
  schema: { body: ChatRequestSchema }
}, handler)

// Used in dashboard for type-safe API calls
const response = await fetch('/v1/chat/completions', {
  body: JSON.stringify(request) // TypeScript knows the shape
})
```

### Middleware Pipeline

Every request flows through ordered hooks:

```
Request → Auth → Rate Limit → PII Mask → Semantic Cache → Provider → Usage Logger → Response
```

### Tenant Isolation

Multi-layered tenant isolation:
- API key authentication with bcrypt hashing
- PostgreSQL Row Level Security (RLS) at the database layer
- Redis key namespacing for rate limits
- Tenant-scoped cache entries

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Start all apps in dev mode
pnpm dev

# Build all apps
pnpm build

# Run tests
pnpm test

# Database commands
pnpm db:migrate      # Run migrations
pnpm db:studio       # Open Drizzle Studio
pnpm db:seed         # Seed test data

# Lint
pnpm lint
```

---

## Tech Stack

### Gateway
- **Runtime:** Node.js 20+
- **Framework:** Fastify 5
- **Validation:** Zod
- **Database:** PostgreSQL 16 + pgvector
- **ORM:** Drizzle ORM
- **Cache/Limiter:** Redis + ioredis
- **Providers:** OpenAI SDK, Anthropic SDK
- **Docs:** @fastify/swagger + fastify-zod-openapi

### Dashboard
- **Framework:** Next.js 15 (App Router)
- **UI:** React 19 + Tailwind CSS
- **Charts:** Recharts
- **Validation:** Zod (shared schemas)

### Monorepo
- **Package Manager:** pnpm
- **Build System:** Turborepo
- **Language:** TypeScript 5

---

## Roadmap

- [x] **Week 0:** Monorepo foundation, schemas package, gateway bootstrap
- [ ] **Week 1:** Core proxy + streaming + Swagger docs
- [ ] **Week 2:** Auth + multi-tenancy + rate limiting
- [ ] **Week 3:** PII masking + cost tracking + usage API
- [ ] **Week 4:** Semantic cache with pgvector
- [ ] **Week 5:** Dashboard

See [plan.md](./plan.md) for the complete build plan.

---

## License

MIT

---

## Notes

This is a portfolio project designed to demonstrate production-grade backend architecture. It's built to be:
- Easy to demo through API docs and dashboard
- Easy to explain in technical interviews
- Architecturally clean and maintainable
- Production-ready patterns without enterprise sprawl
