/**
 * Supergate SDK — HTTP client
 *
 * Thin fetch wrapper used by all resource classes.
 * Handles auth headers, JSON serialization, and error mapping.
 */

import { throwGatewayError } from './errors'

export interface RequestOptions {
  method?:  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?:    unknown
  headers?: Record<string, string>
  signal?:  AbortSignal
}

export class HttpClient {
  private readonly baseUrl:        string
  private readonly apiKey:         string
  private readonly timeout:        number
  private readonly defaultHeaders: Record<string, string>

  constructor(
    baseUrl:        string,
    apiKey:         string,
    timeout:        number,
    defaultHeaders: Record<string, string>
  ) {
    this.baseUrl        = baseUrl.replace(/\/$/, '')
    this.apiKey         = apiKey
    this.timeout        = timeout
    this.defaultHeaders = defaultHeaders
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, signal } = options

    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), this.timeout)
    const mergedSignal = signal ?? controller.signal

    const hasBody = body !== undefined && body !== null

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent':    'supergate-sdk/0.1.0',
          ...this.defaultHeaders,
          ...headers,
        },
        body:   hasBody ? JSON.stringify(body) : undefined,
        signal: mergedSignal,
      })

      clearTimeout(timeoutId)

      // Parse body regardless of status so we can extract error details
      const contentType = response.headers.get('content-type') ?? ''
      const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text()

      if (!response.ok) {
        throwGatewayError(response.status, typeof data === 'object' ? data : { error: { message: data } })
      }

      return data as T
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  }

  get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: 'GET', headers })
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body })
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body })
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }
}
