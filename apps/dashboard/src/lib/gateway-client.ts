/**
 * Typed Gateway API Client
 * 
 * Provides type-safe fetch wrappers for all gateway endpoints.
 * Uses shared Zod schemas for request/response validation.
 */

import {
  RegisterRequestSchema,
  LoginRequestSchema,
  AuthResponseSchema,
  MeResponseSchema,
  type RegisterRequest,
  type LoginRequest,
  type AuthResponse,
  type MeResponse,
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

/**
 * Base fetch wrapper with error handling
 */
async function gatewayFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  schema?: { parse: (data: unknown) => T }
): Promise<T> {
  const url = `${GATEWAY_URL}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new GatewayAPIError(
      errorData.error?.message || `Request failed with status ${response.status}`,
      response.status,
      errorData.error?.code
    )
  }

  const data = await response.json()

  // Validate response with Zod schema if provided
  if (schema) {
    return schema.parse(data)
  }

  return data as T
}

/**
 * Auth API Client
 */
export const authAPI = {
  /**
   * Register a new user and tenant
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    // Validate request
    RegisterRequestSchema.parse(data)
    
    return gatewayFetch<AuthResponse>(
      '/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      AuthResponseSchema
    )
  },

  /**
   * Login with email and password
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    // Validate request
    LoginRequestSchema.parse(data)
    
    return gatewayFetch<AuthResponse>(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      AuthResponseSchema
    )
  },

  /**
   * Get current user info
   */
  async me(token: string): Promise<MeResponse> {
    return gatewayFetch<MeResponse>(
      '/v1/auth/me',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      MeResponseSchema
    )
  },
}

export { GatewayAPIError }
export type { AuthResponse, MeResponse }
