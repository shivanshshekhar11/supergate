/**
 * Supergate SDK — Public types
 *
 * Re-exports the types consumers need from @llm-gateway/schemas,
 * plus SDK-specific types that don't belong in the schemas package.
 */

// ── Re-exports from shared schemas ───────────────────────────────────────────

export type {
  // Chat
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,

  // Usage
  UsageSummary,
  UsageBreakdown,
  UsageBreakdownItem,
  ChartBucket,
  UsageChartResponse,

  // Keys
  CreateKeyRequest,
  CreateKeyResponse,
  KeyMetadata,

  // Tenant BYOK keys
  StoreTenantKeyRequest,
  StoreTenantKeyResponse,
  TenantKeyMetadata,

  // Health
  HealthResponse,

  // Auth
  AuthResponse,
  MeResponse,
} from '@llm-gateway/schemas'

// ── SDK-specific types ────────────────────────────────────────────────────────

/** Options passed to the SupergateClient constructor */
export interface SupergateClientOptions {
  /** Gateway API key (format: gw_...) */
  apiKey: string
  /** Base URL of the gateway. Defaults to http://localhost:3000 */
  baseUrl?: string
  /** Request timeout in milliseconds. Defaults to 30000 */
  timeout?: number
  /** Default headers added to every request */
  defaultHeaders?: Record<string, string>
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data:       T[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

/** Usage log entry returned by getLogs() */
export interface UsageLogEntry {
  id:          string
  requestId:   string | null
  model:       string
  provider:    string
  inputTokens: number
  outputTokens: number
  costUsd:     number
  latencyMs:   number | null
  cached:      boolean
  statusCode:  number
  createdAt:   string
}

/** Options for usage.getLogs() */
export interface GetLogsOptions {
  page?:      number
  pageSize?:  number
  provider?:  string
  model?:     string
  status?:    number
  timeRange?: '24h' | '7d' | '30d'
}

/** Options for usage.getSummary() */
export interface GetSummaryOptions {
  period?: 'daily' | 'weekly' | 'monthly'
}

/** Options for usage.getBreakdown() */
export interface GetBreakdownOptions {
  period?:   'daily' | 'weekly' | 'monthly'
  provider?: string
}

/** Options for usage.getChart() */
export interface GetChartOptions {
  timeRange?: '24h' | '7d' | '30d'
  provider?:  string
}

/** Options for keys.create() */
export interface CreateKeyOptions {
  name?: string
  role?: 'admin' | 'user' | 'viewer'
}
