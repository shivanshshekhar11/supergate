/**
 * Typed Gateway API Client
 *
 * Provides type-safe fetch wrappers for all gateway endpoints.
 * Uses shared Zod schemas for request/response validation.
 *
 * Two-token auth flow:
 * - Short-lived access JWT (15 min) — sent as Authorization: Bearer header.
 * - Long-lived opaque refresh token — httpOnly cookie managed by the browser,
 *   only ever sent to POST /v1/auth/refresh.
 * - On 401, the client silently calls refresh(), updates the in-memory access
 *   token via onTokenRefreshed, and retries the original request once.
 * - If the refresh itself fails, the user is logged out.
 */

import {
  RegisterRequestSchema,
  LoginRequestSchema,
  AuthResponseSchema,
  RefreshResponseSchema,
  MeResponseSchema,
  UsageSummarySchema,
  UsageBreakdownSchema,
  UsageChartResponseSchema,
  UsageLogsResponseSchema,
  StoreTenantKeyResponseSchema,
  ListTenantKeysResponseSchema,
  CreateKeyRequestSchema,
  CreateKeyResponseSchema,
  KeyMetadataSchema,
  type RegisterRequest,
  type LoginRequest,
  type AuthResponse,
  type RefreshResponse,
  type MeResponse,
  type UsageSummary,
  type UsageBreakdown,
  type UsageChartResponse,
  type UsageLogsResponse,
  type StoreTenantKeyResponse,
  type TenantKeyMetadata,
  type CreateKeyRequest,
  type CreateKeyResponse,
  type KeyMetadata,
} from '@llm-gateway/schemas'

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000'

class GatewayAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'GatewayAPIError'
  }
}

// ── Silent-refresh state ──────────────────────────────────────────────────────
// Tracks an in-flight refresh so concurrent 401s don't trigger multiple refreshes.

let isRefreshing = false
let pendingRefreshResolvers: Array<(token: string | null) => void> = []

/**
 * Callback injected by AuthProvider so the client can push a new access token
 * back into React state after a successful silent refresh.
 */
let onTokenRefreshed: ((newToken: string | null) => void) = () => {}

export function setTokenRefreshCallback(cb: (newToken: string | null) => void) {
  onTokenRefreshed = cb
}

/**
 * Performs the actual POST /v1/auth/refresh call.
 * Returns the new access token, or null if the refresh token is expired/revoked.
 */
async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends the httpOnly refresh cookie
    })
    if (!res.ok) return null
    const data: RefreshResponse = RefreshResponseSchema.parse(await res.json())
    return data.accessToken
  } catch {
    return null
  }
}

// ── Base fetch wrapper ────────────────────────────────────────────────────────

/**
 * Base fetch wrapper with error handling, optional Zod validation,
 * and transparent silent-refresh on 401.
 *
 * @param endpoint   - Path relative to GATEWAY_URL
 * @param options    - Standard RequestInit (headers merged internally)
 * @param schema     - Optional Zod schema for response validation
 * @param _retry     - Internal flag: true = this is already a retry after refresh
 */
async function gatewayFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  schema?: { parse: (data: unknown) => T },
  _retry = false
): Promise<T> {
  const url = `${GATEWAY_URL}${endpoint}`

  const hasBody = options.body !== undefined && options.body !== null
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // always include cookies (needed for refresh path)
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  // ── 401 handling — attempt silent refresh ───────────────────────────────
  if (response.status === 401 && !_retry && typeof window !== 'undefined') {
    let newToken: string | null

    if (isRefreshing) {
      // Another request is already refreshing — wait for it
      newToken = await new Promise<string | null>((resolve) => {
        pendingRefreshResolvers.push(resolve)
      })
    } else {
      isRefreshing = true
      newToken = await doRefresh()
      isRefreshing = false

      // Notify all queued callers
      pendingRefreshResolvers.forEach((r) => r(newToken))
      pendingRefreshResolvers = []

      // Push new token into AuthProvider state
      onTokenRefreshed(newToken)
    }

    if (newToken) {
      // Retry the original request with the fresh token
      const retriedOptions: RequestInit = {
        ...options,
        headers: {
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        },
      }
      return gatewayFetch<T>(endpoint, retriedOptions, schema, true)
    }

    // Refresh failed — force logout
    onTokenRefreshed(null)
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new GatewayAPIError('Session expired. Please log in again.', 401, 'session_expired')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new GatewayAPIError(
      errorData.error?.message || `Request failed with status ${response.status}`,
      response.status,
      errorData.error?.code
    )
  }

  // 204 No Content
  if (response.status === 204) return undefined as T

  const data = await response.json()
  return schema ? schema.parse(data) : (data as T)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authAPI = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    RegisterRequestSchema.parse(data)
    return gatewayFetch<AuthResponse>(
      '/v1/auth/register',
      { method: 'POST', body: JSON.stringify(data) },
      AuthResponseSchema
    )
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    LoginRequestSchema.parse(data)
    return gatewayFetch<AuthResponse>(
      '/v1/auth/login',
      { method: 'POST', body: JSON.stringify(data) },
      AuthResponseSchema
    )
  },

  async me(token: string): Promise<MeResponse> {
    return gatewayFetch<MeResponse>(
      '/v1/auth/me',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      MeResponseSchema
    )
  },

  /**
   * Exchange the httpOnly refresh cookie for a new access JWT.
   * Called automatically by the 401 interceptor; the AuthProvider also calls
   * this on mount to restore session state without needing localStorage.
   */
  async refresh(): Promise<RefreshResponse | null> {
    try {
      const res = await fetch(`${GATEWAY_URL}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return null
      return RefreshResponseSchema.parse(await res.json())
    } catch {
      return null
    }
  },

  /**
   * Revoke the refresh token server-side and clear the httpOnly cookie.
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${GATEWAY_URL}/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Best-effort; local state is cleared regardless
    }
  },

  async updateProfile(
    token: string,
    data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }
  ): Promise<{ id: string; email: string; name: string; createdAt: string }> {
    return gatewayFetch(
      '/v1/auth/profile',
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) }
    )
  },

  async updateTenant(
    token: string,
    name: string
  ): Promise<{ id: string; name: string; tier: string; createdAt: string }> {
    return gatewayFetch(
      '/v1/auth/tenant',
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ name }) }
    )
  },
}

// ── Usage ─────────────────────────────────────────────────────────────────────

export const usageAPI = {
  /**
   * Aggregated totals for the period — used for trend calculation and empty-state guard.
   */
  async getSummary(
    apiKey: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<UsageSummary> {
    return gatewayFetch<UsageSummary>(
      `/v1/usage?period=${period}`,
      { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } },
      UsageSummarySchema
    )
  },

  /**
   * Cost / token breakdown grouped by model + provider.
   * Accepts optional provider filter (applied server-side).
   */
  async getBreakdown(
    apiKey: string,
    period: 'daily' | 'weekly' | 'monthly' = 'weekly',
    provider?: string
  ): Promise<UsageBreakdown> {
    const params = new URLSearchParams({ period })
    if (provider && provider !== 'all') params.append('provider', provider)
    return gatewayFetch<UsageBreakdown>(
      `/v1/usage/breakdown?${params}`,
      { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } },
      UsageBreakdownSchema
    )
  },

  /**
   * Pre-bucketed chart data: 24h → 12×2hr, 7d → 7×daily, 30d → 30×daily.
   */
  async getChart(
    apiKey: string,
    timeRange: '24h' | '7d' | '30d' = '7d',
    provider?: string
  ): Promise<UsageChartResponse> {
    const params = new URLSearchParams({ timeRange })
    if (provider && provider !== 'all') params.append('provider', provider)
    return gatewayFetch<UsageChartResponse>(
      `/v1/usage/chart?${params}`,
      { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } },
      UsageChartResponseSchema
    )
  },

  /**
   * Paginated usage logs with optional filters.
   */
  async getLogs(
    apiKey: string,
    params: {
      page?: number
      pageSize?: number
      provider?: string
      model?: string
      status?: number
      timeRange?: '24h' | '7d' | '30d'
    } = {}
  ): Promise<UsageLogsResponse> {
    const q = new URLSearchParams()
    if (params.page)                               q.append('page',      params.page.toString())
    if (params.pageSize)                           q.append('pageSize',  params.pageSize.toString())
    if (params.provider && params.provider !== 'all') q.append('provider', params.provider)
    if (params.model    && params.model    !== 'all') q.append('model',    params.model)
    if (params.status)                             q.append('status',    params.status.toString())
    if (params.timeRange)                          q.append('timeRange', params.timeRange)
    const qs = q.toString()
    return gatewayFetch<UsageLogsResponse>(
      `/v1/usage/logs${qs ? `?${qs}` : ''}`,
      { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } },
      UsageLogsResponseSchema
    )
  },
}

// ── Playground ────────────────────────────────────────────────────────────────

export type PlaygroundModel = {
  id: string
  provider: string
  label: string
  keySource: 'byok' | 'gateway'
}

export type PlaygroundModelsResponse = {
  tier: string
  models: PlaygroundModel[]
}

export type PlaygroundMeta = {
  latencyMs: number
  costUsd: number
  cached: boolean
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
}

export type PlaygroundResponse = {
  requestId: string
  response: {
    id: string
    model: string
    choices: Array<{ index: number; message: { role: string; content: string }; finish_reason: string | null }>
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }
  meta: PlaygroundMeta
}

export const playgroundAPI = {
  async getModels(token: string): Promise<PlaygroundModelsResponse> {
    return gatewayFetch(
      '/v1/playground/models',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    )
  },

  async chat(
    token: string,
    payload: {
      model: string
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
      systemPrompt?: string
      temperature?: number
      max_tokens?: number
    }
  ): Promise<PlaygroundResponse> {
    return gatewayFetch('/v1/playground/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
  },
}

// ── Gateway API Keys ──────────────────────────────────────────────────────────

export const gatewayKeysAPI = {
  /** List all gateway API keys for the tenant. */
  async list(token: string): Promise<KeyMetadata[]> {
    const res = await gatewayFetch<{ keys: KeyMetadata[] }>(
      '/v1/keys',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
    )
    return res.keys.map(k => KeyMetadataSchema.parse(k))
  },

  /** Create a new gateway API key (admin only). Raw key shown once. */
  async create(token: string, payload: CreateKeyRequest): Promise<CreateKeyResponse> {
    CreateKeyRequestSchema.parse(payload)
    return gatewayFetch<CreateKeyResponse>(
      '/v1/keys',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) },
      CreateKeyResponseSchema,
    )
  },

  /** Revoke a gateway API key by ID (admin only). */
  async revoke(token: string, id: string): Promise<void> {
    await gatewayFetch<unknown>(
      `/v1/keys/${id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    )
  },
}

// ── Tenant (BYOK) Keys ────────────────────────────────────────────────────────

export const tenantKeysAPI = {
  /** List all BYOK keys for the tenant (admin + member). */
  async list(token: string): Promise<TenantKeyMetadata[]> {
    const res = await gatewayFetch<{ keys: TenantKeyMetadata[] }>(
      '/v1/tenant/keys',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
    )
    return ListTenantKeysResponseSchema.parse(res.keys)
  },

  /** Add a new BYOK key (admin only). */
  async create(token: string, provider: string, apiKey: string): Promise<StoreTenantKeyResponse> {
    return gatewayFetch<StoreTenantKeyResponse>(
      '/v1/tenant/keys',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ provider, apiKey }) },
      StoreTenantKeyResponseSchema
    )
  },

  /** Rotate / replace an existing BYOK key (admin only). */
  async update(token: string, provider: string, apiKey: string): Promise<StoreTenantKeyResponse> {
    return gatewayFetch<StoreTenantKeyResponse>(
      `/v1/tenant/keys/${provider}`,
      { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ apiKey }) },
      StoreTenantKeyResponseSchema
    )
  },

  /** Delete a BYOK key (admin only). */
  async remove(token: string, provider: string): Promise<void> {
    await gatewayFetch<unknown>(
      `/v1/tenant/keys/${provider}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    )
  },
}

export { GatewayAPIError }
export type {
  AuthResponse,
  RefreshResponse,
  MeResponse,
  UsageSummary,
  UsageBreakdown,
  UsageChartResponse,
  UsageLogsResponse,
  StoreTenantKeyResponse,
  TenantKeyMetadata,
  KeyMetadata,
  CreateKeyRequest,
  CreateKeyResponse,
}
