/**
 * Supergate SDK — Chat resource
 *
 * Delegates to the OpenAI SDK with the gateway as the base URL.
 * This means all OpenAI SDK features (streaming, function calling, etc.)
 * work transparently through the gateway.
 *
 * Usage:
 *   const client = new SupergateClient({ apiKey: 'gw_...' })
 *   const response = await client.chat.completions.create({ model: 'gpt-4o', messages: [...] })
 */

import type { HttpClient } from '../http'

// We use a lazy import so openai is truly optional at runtime
// (consumers who only use usage/keys don't need it installed)
type OpenAICompletions = {
  create(params: Record<string, unknown>): Promise<unknown>
}

type OpenAIChat = {
  completions: OpenAICompletions
}

/**
 * Thin wrapper that instantiates the OpenAI client pointed at the gateway.
 * Falls back to a direct fetch implementation if the openai package is not installed.
 */
export class ChatResource {
  readonly completions: CompletionsResource

  constructor(http: HttpClient, baseUrl: string, apiKey: string) {
    this.completions = new CompletionsResource(http, baseUrl, apiKey)
  }
}

export class CompletionsResource {
  private readonly http:    HttpClient
  private readonly baseUrl: string
  private readonly apiKey:  string

  constructor(http: HttpClient, baseUrl: string, apiKey: string) {
    this.http    = http
    this.baseUrl = baseUrl
    this.apiKey  = apiKey
  }

  /**
   * Create a chat completion.
   *
   * If the `openai` package is installed, delegates to it (full feature parity).
   * Otherwise falls back to a direct fetch call (non-streaming only).
   *
   * @example
   * // Non-streaming
   * const res = await client.chat.completions.create({
   *   model: 'gpt-4o',
   *   messages: [{ role: 'user', content: 'Hello' }],
   * })
   * console.log(res.choices[0].message.content)
   *
   * @example
   * // Streaming
   * const stream = await client.chat.completions.create({
   *   model: 'gpt-4o',
   *   messages: [{ role: 'user', content: 'Hello' }],
   *   stream: true,
   * })
   * for await (const chunk of stream) {
   *   process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
   * }
   */
  async create(params: {
    model:              string
    messages:           Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    stream?:            boolean
    temperature?:       number
    max_tokens?:        number
    top_p?:             number
    frequency_penalty?: number
    presence_penalty?:  number
    [key: string]:      unknown
  }): Promise<unknown> {
    // Try to use the openai package if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { OpenAI } = await import('openai') as any
      const openai = new OpenAI({ apiKey: this.apiKey, baseURL: `${this.baseUrl}/v1` })
      return openai.chat.completions.create(params)
    } catch {
      // openai package not installed — use direct fetch (non-streaming only)
      if (params.stream) {
        throw new Error(
          'Streaming requires the `openai` package to be installed. ' +
          'Run: npm install openai'
        )
      }
      return this.http.post('/v1/chat/completions', params)
    }
  }
}
