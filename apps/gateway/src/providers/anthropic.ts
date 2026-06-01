import Anthropic from '@anthropic-ai/sdk'
import { ChatRequest, ChatResponse, ChatStreamChunk } from '@llm-gateway/schemas'
import { LLMProvider, ProviderConfig } from './types'
import { CircuitBreaker } from '../lib/circuit-breaker'

/**
 * Anthropic cost table (USD per token) — updated June 2026
 * Source: https://www.anthropic.com/api
 */
const COST_TABLE: Record<string, { inputUsd: number; outputUsd: number }> = {
  'claude-opus-4-8':   { inputUsd: 0.000005,  outputUsd: 0.000025 },
  'claude-sonnet-4-6': { inputUsd: 0.000003,  outputUsd: 0.000015 },
  'claude-haiku-4-5':  { inputUsd: 0.000001,  outputUsd: 0.000005 },
}


/**
 * Anthropic Provider implementation
 * Normalizes Anthropic responses to OpenAI-compatible format
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const
  private client: Anthropic
  private circuitBreaker: CircuitBreaker

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    })
    this.circuitBreaker = new CircuitBreaker('anthropic')
  }

  /**
   * Non-streaming chat completion
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.circuitBreaker.canRequest()) {
      throw new Error('Anthropic circuit breaker is OPEN')
    }

    try {
      // Extract system message if present
      const systemMessage = request.messages.find((m) => m.role === 'system')?.content
      const messages = request.messages.filter((m) => m.role !== 'system')

      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.max_tokens || 4096,
        temperature: request.temperature,
        top_p: request.top_p,
        system: systemMessage,
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        stream: false,
      })

      this.circuitBreaker.recordSuccess()

      // Normalize to OpenAI format
      const content = response.content[0]
      const text = content.type === 'text' ? content.text : ''

      return {
        id: response.id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: response.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: text,
            },
            finish_reason: this.mapStopReason(response.stop_reason),
          },
        ],
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      }
    } catch (error) {
      this.circuitBreaker.recordFailure()
      throw error
    }
  }

  /**
   * Streaming chat completion
   */
  async *stream(request: ChatRequest): AsyncIterable<ChatStreamChunk> {
    if (!this.circuitBreaker.canRequest()) {
      throw new Error('Anthropic circuit breaker is OPEN')
    }

    try {
      // Extract system message if present
      const systemMessage = request.messages.find((m) => m.role === 'system')?.content
      const messages = request.messages.filter((m) => m.role !== 'system')

      const stream = await this.client.messages.create({
        model: request.model,
        max_tokens: request.max_tokens || 4096,
        temperature: request.temperature,
        top_p: request.top_p,
        system: systemMessage,
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        stream: true,
      })

      const id = `chatcmpl-${Date.now()}`
      const created = Math.floor(Date.now() / 1000)

      for await (const event of stream) {
        this.circuitBreaker.recordSuccess()

        if (event.type === 'content_block_start') {
          // First chunk with role
          yield {
            id,
            object: 'chat.completion.chunk',
            created,
            model: request.model,
            choices: [
              {
                index: 0,
                delta: {
                  role: 'assistant',
                  content: undefined,
                },
                finish_reason: null,
              },
            ],
          }
        } else if (event.type === 'content_block_delta') {
          // Content chunks
          if (event.delta.type === 'text_delta') {
            yield {
              id,
              object: 'chat.completion.chunk',
              created,
              model: request.model,
              choices: [
                {
                  index: 0,
                  delta: {
                    content: event.delta.text,
                  },
                  finish_reason: null,
                },
              ],
            }
          }
        } else if (event.type === 'message_stop') {
          // Final chunk
          yield {
            id,
            object: 'chat.completion.chunk',
            created,
            model: request.model,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
          }
        }
      }
    } catch (error) {
      this.circuitBreaker.recordFailure()
      throw error
    }
  }

  /**
   * List supported models
   */
  modelsSupported(): string[] {
    return Object.keys(COST_TABLE)
  }

  /**
   * Get cost per token for a model
   */
  costPerToken(model: string): { inputUsd: number; outputUsd: number } | null {
    return COST_TABLE[model] || null
  }

  /**
   * Get circuit breaker state (for health checks)
   */
  getCircuitBreakerState() {
    const state = this.circuitBreaker.getState()
    const failures = this.circuitBreaker.getFailures()
    const lastFailure = this.circuitBreaker.getLastFailure()
    
    // Calculate next retry time if circuit is open
    let nextRetry: string | null = null
    if (state === 'OPEN' && lastFailure) {
      const resetTimeoutMs = 30000 // 30 seconds default from config
      const nextRetryTime = new Date(lastFailure + resetTimeoutMs)
      nextRetry = nextRetryTime.toISOString()
    }

    return {
      state: state.toLowerCase() as 'closed' | 'open' | 'half-open',
      failures,
      lastFailure: lastFailure ? new Date(lastFailure).toISOString() : null,
      nextRetry,
    }
  }

  /**
   * Map Anthropic stop reason to OpenAI finish_reason
   */
  private mapStopReason(
    stopReason: string | null
  ): 'stop' | 'length' | 'content_filter' | 'tool_calls' | null {
    if (!stopReason) return null

    switch (stopReason) {
      case 'end_turn':
        return 'stop'
      case 'max_tokens':
        return 'length'
      case 'stop_sequence':
        return 'stop'
      default:
        return 'stop'
    }
  }
}
