# Changelog

All notable changes to `@supergate/sdk` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2026-04-20

### Added
- `SupergateClient` — main entry point with `chat`, `keys`, `tenantKeys`, `usage`, `health` resources
- `chat.completions.create()` — delegates to OpenAI SDK with gateway as `baseURL`; falls back to direct fetch if `openai` is not installed
- `keys.list()`, `keys.create()`, `keys.revoke()` — gateway API key management
- `tenantKeys.list()`, `tenantKeys.create()`, `tenantKeys.update()`, `tenantKeys.remove()` — BYOK provider key management
- `usage.getSummary()`, `usage.getBreakdown()`, `usage.getChart()`, `usage.getLogs()` — usage analytics
- `health.get()` — gateway and provider health with circuit breaker states
- Typed error classes: `SupergateError`, `AuthError`, `PermissionError`, `RateLimitError`, `ProviderError`, `ValidationError`
- Dual CJS + ESM build output
- Full TypeScript declarations
