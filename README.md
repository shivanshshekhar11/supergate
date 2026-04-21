# Supergate

> A production-grade, multi-tenant API gateway for large language model providers.

**Stack:** Turborepo monorepo · Fastify + TypeScript · PostgreSQL (pgvector) · Redis · Next.js 15

---

## What This Is

Supergate sits in front of OpenAI, Anthropic, Google, Cohere, and Mistral and gives teams one stable API with the operational features production systems need.

| Feature | Description |
|---|---|
| **Unified API** | One OpenAI-compatible endpoint regardless of underlying provider |
| **Multi-tenancy** | Isolated API keys, RBAC, and usage data per tenant via PostgreSQL RLS |
| **Hybrid Key Management** | Gateway-owned keys (easy onboarding) + tenant BYOK (enterprise compliance) |
| **Semantic caching** | pgvector cosine similarity cache — near-duplicate prompts served from cache |
| **Rate limiting** | Redis-backed atomic sliding window (TPM + RPM) per tenant |
| **Cost attribution** | Per-tenant token tracking with dollar-cost attribution |
| **PII masking** | Regex scrub on request bodies before storage |
| **Observability** | Structured logs, circuit breaker states, cache hit rates, Swagger UI |

**The architectural win:** One Zod schema → Fastify validation → OpenAPI spec → TypeScript types in the dashboard. Zero duplication. End-to-end type safety.

---

## Project Structure

```
supergate/
├── apps/
│   ├── gateway/          # Fastify API (port 3000)
│   ├── dashboard/        # Next.js 15 dashboard (port 3001)
│   └── docs/             # Fumadocs documentation site (port 3002)
├── packages/
│   ├── schemas/          # Shared Zod schemas — single source of truth
│   └── sdk/              # @supergate/sdk — TypeScript SDK for npm
├── nginx/                # nginx reverse proxy config
├── docker-compose.yml    # Local dev infrastructure (Postgres + Redis)
├── docker-compose.prod.yml  # Full production stack (7 containers)
└── deploy.sh             # One-command Droplet deploy
```

---

## Quick Start

### Prerequisites

- Node.js 20+, pnpm 9+, Docker + Docker Compose

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker compose up -d

# 3. Configure environment
cp apps/gateway/.env.example apps/gateway/.env
# Add your OPENAI_API_KEY, ANTHROPIC_API_KEY, ENCRYPTION_MASTER_KEY, JWT_SECRET

cp apps/dashboard/.env.example apps/dashboard/.env.local

# 4. Run migrations and seed
pnpm db:migrate
pnpm --filter @llm-gateway/gateway db:seed
# ⚠️ Save the API key printed to console — shown once only

# 5. Start dev servers
pnpm dev
```

| Service | URL |
|---|---|
| Gateway API | http://localhost:3000 |
| Swagger UI | http://localhost:3000/docs |
| Dashboard | http://localhost:3001 |
| Docs site | http://localhost:3002 |

**Default login:** `admin@example.com` / `password123`

---

## Architecture

```
Request → Auth → Rate Limit → PII Mask → Semantic Cache → Provider → Usage Logger
```

Every request flows through an ordered middleware pipeline. The auth middleware accepts both gateway API keys (`gw_...`) and dashboard JWTs in the same `Authorization: Bearer` header — token type is detected automatically.

```
Authorization: Bearer <token>
                       │
              ┌────────┴────────┐
         gw_... prefix      3-segment JWT
         (bcrypt verify)    (JWT verify)
              └────────┬────────┘
                 tenantContext
```

### Key Architectural Decisions

| Decision | Why it matters |
|---|---|
| Shared Zod schemas in `packages/schemas` | One definition → validation + OpenAPI docs + dashboard types |
| Unified auth middleware | API keys and JWTs both populate `tenantContext` — no per-route auth hacks |
| Hybrid key management (gateway + BYOK) | Serves startups (easy) and enterprises (compliance) from the same codebase |
| PostgreSQL RLS for tenant isolation | DB-level enforcement — survives ORM bugs |
| Redis Lua atomic rate limiting | No race conditions across concurrent requests |
| pgvector HNSW semantic cache | Near-duplicate prompts served from cache with adaptive cosine threshold |
| SSE streaming passthrough | Gateway is transparent to any OpenAI-compatible client |
| Circuit breaker per provider | Self-healing; 3-state (CLOSED/OPEN/HALF_OPEN) |

---

## API

### Authentication

All endpoints accept `Authorization: Bearer <token>` where token is either:
- A gateway API key: `gw_<48 hex chars>` — for programmatic access
- A dashboard JWT — for the web UI

### Endpoints

```
# Chat
POST   /v1/chat/completions     OpenAI-compatible (streaming + non-streaming)

# Usage & Analytics
GET    /v1/usage                Aggregated summary (period=daily|weekly|monthly)
GET    /v1/usage/breakdown      Usage by model + provider
GET    /v1/usage/chart          Pre-bucketed chart data (24h|7d|30d)
GET    /v1/usage/logs           Paginated request logs with filters

# Key Management
POST   /v1/keys                 Create gateway API key (admin)
GET    /v1/keys                 List keys — prefix + metadata only (admin/member)
DELETE /v1/keys/:id             Revoke a key (admin)

# BYOK
POST   /v1/tenant/keys          Store provider key — AES-256-GCM encrypted (admin)
GET    /v1/tenant/keys          List BYOK keys — masked (admin/member)
PUT    /v1/tenant/keys/:provider Rotate a BYOK key (admin)
DELETE /v1/tenant/keys/:provider Remove a BYOK key (admin)

# Cache Analytics
GET    /v1/cache/stats          Cache hit rate, cost savings, top models
GET    /v1/cache/timeseries     Daily cache performance for charting

# Playground
POST   /v1/playground/chat      Non-streaming proxy with full metadata response
GET    /v1/playground/models    Available models with BYOK status

# Auth (JWT)
POST   /v1/auth/register        Create user + tenant, return JWT
POST   /v1/auth/login           Verify credentials, return JWT
GET    /v1/auth/me              Current user info

# Health
GET    /health                  Service health + circuit breaker states (public)
GET    /docs                    Swagger UI (public)
```

---

## SDK

```bash
npm install @supergate/sdk
```

```typescript
import { SupergateClient } from '@supergate/sdk'

const client = new SupergateClient({
  apiKey:  'gw_your_key',
  baseUrl: 'https://your-gateway.com',
})

// Chat
const res = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello' }],
})

// Usage
const summary = await client.usage.getSummary({ period: 'weekly' })

// Key management
const key = await client.keys.create({ name: 'ci', role: 'user' })
```

See [`packages/sdk/README.md`](./packages/sdk/README.md) for the full API reference.

---

## Dashboard

The dashboard is a Next.js 15 app with 10 pages:

| Page | Path | Access |
|---|---|---|
| Landing | `/landing` | Public |
| Login / Register | `/login`, `/register` | Public |
| Overview | `/` | All roles |
| Usage Logs | `/usage` | All roles |
| API Keys | `/api-keys` | Admin: CRUD · Member: view |
| LLM Keys (BYOK) | `/keys` | Admin: CRUD · Member: view |
| Playground | `/playground` | All roles |
| Settings | `/settings` | All roles |

---

## Deployment

One-command deploy to a DigitalOcean Droplet ($24/mo, ~8 months on $200 student credit):

```bash
# On the Droplet after git clone + .env setup
./deploy.sh
```

See [`DEPLOY.md`](./DEPLOY.md) for the full step-by-step guide including SSL setup.

---

## Development Commands

```bash
pnpm dev          # Start all apps in watch mode
pnpm build        # Build all packages
pnpm test         # Run all tests (353 passing)
pnpm db:migrate   # Run database migrations
pnpm db:studio    # Open Drizzle Studio
```

---

## Tradeoffs & Limitations

- **Circuit breaker state is in-process** — not shared across replicas. Redis-backed state would be the fix for horizontal scaling.
- **Semantic cache threshold is global** — per-model tuning is a roadmap item.
- **Streaming requests are not cached** — responses are served from the provider in real time.
- **Rate limit reconciliation is approximate** — token count is estimated pre-request (`wordCount × 1.3`) and reconciled post-response.

---

## License

MIT
