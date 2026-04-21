/**
 * Supergate SDK — Error classes
 *
 * All errors thrown by the SDK extend SupergateError so callers can
 * catch the base class and still get structured information.
 */

export class SupergateError extends Error {
  readonly status:    number
  readonly code:      string
  readonly requestId: string | undefined

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message)
    this.name      = 'SupergateError'
    this.status    = status
    this.code      = code
    this.requestId = requestId
    // Maintain proper prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** 401 — missing or invalid API key */
export class AuthError extends SupergateError {
  constructor(message: string, requestId?: string) {
    super(message, 401, 'unauthorized', requestId)
    this.name = 'AuthError'
  }
}

/** 403 — valid key but insufficient permissions (e.g. BYOK required) */
export class PermissionError extends SupergateError {
  constructor(message: string, requestId?: string) {
    super(message, 403, 'forbidden', requestId)
    this.name = 'PermissionError'
  }
}

/** 429 — rate limit exceeded */
export class RateLimitError extends SupergateError {
  readonly retryAfter: number | undefined

  constructor(message: string, retryAfter?: number, requestId?: string) {
    super(message, 429, 'rate_limit_exceeded', requestId)
    this.name       = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/** 503 — upstream provider unavailable (circuit breaker open) */
export class ProviderError extends SupergateError {
  constructor(message: string, requestId?: string) {
    super(message, 503, 'provider_unavailable', requestId)
    this.name = 'ProviderError'
  }
}

/** 400 — request validation failed */
export class ValidationError extends SupergateError {
  constructor(message: string, requestId?: string) {
    super(message, 400, 'validation_error', requestId)
    this.name = 'ValidationError'
  }
}

/**
 * Parse a gateway error response and throw the appropriate typed error.
 */
export function throwGatewayError(status: number, body: Record<string, unknown>): never {
  const err       = (body.error ?? {}) as Record<string, unknown>
  const message   = (err.message as string)   ?? `Request failed with status ${status}`
  const requestId = (err.requestId as string)  ?? undefined

  if (status === 401) throw new AuthError(message, requestId)
  if (status === 403) throw new PermissionError(message, requestId)
  if (status === 429) {
    const retryAfter = typeof err.retryAfter === 'number' ? err.retryAfter : undefined
    throw new RateLimitError(message, retryAfter, requestId)
  }
  if (status === 503) throw new ProviderError(message, requestId)
  if (status === 400) throw new ValidationError(message, requestId)
  throw new SupergateError(message, status, (err.code as string) ?? 'unknown_error', requestId)
}
