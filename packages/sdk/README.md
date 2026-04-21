# @supergate/sdk

[![npm version](https://img.shields.io/npm/v/@supergate/sdk.svg)](https://www.npmjs.com/package/@supergate/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@supergate/sdk.svg)](https://www.npmjs.com/package/@supergate/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

TypeScript SDK for the [Supergate LLM Gateway](https://github.com/shivanshshekhar11/supergate) — a multi-tenant API gateway for OpenAI, Anthropic, Google, Cohere, and Mistral with semantic caching, rate limiting, and cost attribution.

## What this SDK covers

The gateway exposes an OpenAI-compatible `/v1/chat/completions` endpoint, so any existing OpenAI SDK already works against it by changing `baseURL`. This SDK adds the **operational surface** that OpenAI's SDK doesn't cover:

| Resource | What it does |
|---|---|
| `client.chat` | OpenAI-compatible chat completions (delegates to OpenAI SDK) |
| `client.keys` | Create, list, and revoke gateway API keys |
| `client.tenantKeys` | Manage BYOK provider keys (OpenAI, Anthropic, Google, Cohere, Mistral) |
| `client.usage` | Query cost, token counts, and request history |
| `client.health` | Gateway and provider health with circuit breaker states |

---

## Installation

```bash
npm install @supergate/sdk
# or
pnpm add @supergate/sdk
# or
yarn add @supergate/sdk
```

For streaming support, also install the OpenAI SDK:

```bash
npm install openai
```

---

## Quickstart

```typescript
import { SupergateClient } from '@supergate/sdk'

const client = new SupergateClient({
  apiKey:  'gw_your_api_key',
  baseUrl: 'https://your-gateway.com',  // defaults to http://localhost:3000
})

// Send a chat request
const response = await client.chat.completions.create({
  model:    'gpt-4o',
  messages: [{ role: 'user', content: 'Explain semantic caching in one sentence.' }],
})

console.log(response.choices[0].message.content)
```

---

## Chat completions

The `chat` resource delegates to the OpenAI SDK with the gateway as `baseURL`. All OpenAI SDK features work transparently.

### Non-streaming

```typescript
const response = await client.chat.completions.create({
  model:       'gpt-4o',
  messages:    [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
  max_tokens:  1024,
})

console.log(response.choices[0].message.content)
console.log(response.usage.total_tokens)
```

### Streaming

Requires the `openai` package to be installed.

```typescript
const stream = await client.chat.completions.create({
  model:    'gpt-4o',
  messages: [{ role: 'user', content: 'Write a haiku about caching.' }],
  stream:   true,
})

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
}
```

### Supported models

| Provider | Models |
|---|---|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| Anthropic | `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229` |
| Google | `gemini-1.5-pro`, `gemini-1.5-flash` |
| Cohere | `command-r-plus`, `command-r` |
| Mistral | `mistral-large-latest`, `mistral-small-latest` |

---

## Key management

```typescript
// List all keys (prefixes and metadata only — raw values never returned)
const { keys } = await client.keys.list()

// Create a new key — raw value shown once, store it securely
const newKey = await client.keys.create({ name: 'prod-service', role: 'user' })
console.log(newKey.key)  // gw_abc123...

// Revoke a key
await client.keys.revoke(newKey.id)
```

---

## BYOK — Bring Your Own Key

Configure your own LLM provider API keys. When set, they take precedence over the gateway's shared keys.

```typescript
// Add your OpenAI key
await client.tenantKeys.create({ provider: 'openai', apiKey: 'sk-proj-...' })

// List configured keys (masked)
const keys = await client.tenantKeys.list()
// [{ provider: 'openai', apiKeyMasked: 'sk-proj-...xyz', isActive: true }]

// Rotate a key (old key deactivated immediately)
await client.tenantKeys.update('openai', 'sk-proj-new...')

// Remove a key
await client.tenantKeys.remove('openai')
```

Supported providers: `openai` | `anthropic` | `google` | `cohere` | `mistral`

---

## Usage analytics

```typescript
// Aggregated totals
const summary = await client.usage.getSummary({ period: 'weekly' })
console.log(`$${summary.totalCostUsd.toFixed(4)} spent this week`)
console.log(`${(summary.cacheHitRate * 100).toFixed(1)}% cache hit rate`)

// Breakdown by model and provider
const breakdown = await client.usage.getBreakdown({ period: 'weekly' })
breakdown.forEach(b => {
  console.log(`${b.model}: ${b.requests} requests, $${b.costUsd.toFixed(4)}`)
})

// Chart data (pre-bucketed for visualization)
const chart = await client.usage.getChart({ timeRange: '7d' })
chart.buckets.forEach(b => console.log(`${b.label}: ${b.requests} requests`))

// Paginated logs
const logs = await client.usage.getLogs({ timeRange: '7d', provider: 'openai', pageSize: 20 })
logs.data.forEach(log => {
  console.log(`${log.model} — ${log.cached ? 'CACHE HIT' : `${log.latencyMs}ms`} — $${log.costUsd.toFixed(4)}`)
})
```

---

## Health check

```typescript
const health = await client.health.get()
console.log(health.status)  // 'healthy' | 'degraded'

health.providers?.forEach(p => {
  console.log(`${p.name}: ${p.circuitBreaker.state}`)
  // openai: closed
  // anthropic: closed
})
```

---

## Error handling

All errors extend `SupergateError` so you can catch the base class or specific subtypes.

```typescript
import {
  SupergateClient,
  AuthError,
  RateLimitError,
  ProviderError,
  SupergateError,
} from '@supergate/sdk'

try {
  const response = await client.chat.completions.create({ ... })
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}s`)
  } else if (err instanceof AuthError) {
    console.log('Invalid or revoked API key')
  } else if (err instanceof ProviderError) {
    console.log('Provider unavailable (circuit breaker open)')
  } else if (err instanceof SupergateError) {
    console.log(`Gateway error ${err.status}: ${err.message} (${err.code})`)
  }
}
```

| Error class | HTTP status | When thrown |
|---|---|---|
| `AuthError` | 401 | Missing or invalid API key |
| `PermissionError` | 403 | Valid key, insufficient role or BYOK required |
| `RateLimitError` | 429 | TPM or RPM limit exceeded |
| `ProviderError` | 503 | Provider circuit breaker is open |
| `ValidationError` | 400 | Request body failed schema validation |
| `SupergateError` | any | Base class for all other errors |

---

## Configuration

```typescript
const client = new SupergateClient({
  apiKey:  'gw_...',           // required
  baseUrl: 'https://...',      // default: http://localhost:3000
  timeout: 60_000,             // ms, default: 30000
  defaultHeaders: {            // added to every request
    'X-App-Version': '1.0.0',
  },
})
```

---

## TypeScript

The SDK is written in TypeScript and ships full type declarations. No `@types` package needed.

```typescript
import type {
  ChatResponse,
  UsageSummary,
  UsageBreakdown,
  HealthResponse,
  SupergateClientOptions,
} from '@supergate/sdk'
```

---

## Self-hosting

The SDK works against any Supergate gateway instance. Point `baseUrl` at your deployment:

```typescript
const client = new SupergateClient({
  apiKey:  process.env.SUPERGATE_API_KEY!,
  baseUrl: process.env.SUPERGATE_URL ?? 'http://localhost:3000',
})
```

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Source: [github.com/shivanshshekhar11/supergate](https://github.com/shivanshshekhar11/supergate)*
