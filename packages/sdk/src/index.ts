/**
 * @supergate/sdk
 *
 * TypeScript SDK for the Supergate LLM Gateway.
 *
 * @example
 * import { SupergateClient } from '@supergate/sdk'
 *
 * const client = new SupergateClient({ apiKey: 'gw_...', baseUrl: 'https://your-gateway.com' })
 * const response = await client.chat.completions.create({ model: 'gpt-4o', messages: [...] })
 */

// Main client
export { SupergateClient } from './client'

// Error classes
export {
  SupergateError,
  AuthError,
  PermissionError,
  RateLimitError,
  ProviderError,
  ValidationError,
} from './errors'

// Resource classes (for advanced use / type narrowing)
export { ChatResource, CompletionsResource } from './resources/chat'
export { KeysResource }                      from './resources/keys'
export { TenantKeysResource }                from './resources/tenant-keys'
export { UsageResource }                     from './resources/usage'
export { HealthResource }                    from './resources/health'

// All public types
export type {
  SupergateClientOptions,
  PaginatedResponse,
  UsageLogEntry,
  GetLogsOptions,
  GetSummaryOptions,
  GetBreakdownOptions,
  GetChartOptions,
  CreateKeyOptions,

  // Re-exported from @llm-gateway/schemas
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  UsageSummary,
  UsageBreakdown,
  UsageBreakdownItem,
  UsageChartResponse,
  ChartBucket,
  HealthResponse,
  AuthResponse,
  MeResponse,
} from './types'

export type { KeyMetadata, CreatedKey }                                    from './resources/keys'
export type { TenantKeyMetadata, CreatedTenantKey, SupportedProvider }    from './resources/tenant-keys'
