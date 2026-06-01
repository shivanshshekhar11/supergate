import { Mistral } from '@mistralai/mistralai'
import { ChatRequest, ChatResponse, ChatStreamChunk } from '@llm-gateway/schemas'
import { LLMProvider, ProviderConfig } from './types'
import { CircuitBreaker } from '../lib/circuit-breaker'

/**
 * Mistral cost table (USD per token) — updated June 2026
 * Source: https://mistral.ai/technology/#pricing
 */
const COST_TABLE: Record<string, { inputUsd: number; outputUsd: number }> = {
  // Mistral Large 3 (most capable)
  'mistral-large-latest':  { inputUsd: 0.000003,  outputUsd: 0.000009 },
  // Mistral Medium 3.5 (balanced)
  'mistral-medium-latest': { inputUsd: 0.0000027, outputUsd: 0.0000081 },
  // Mistral Small 4 (fast and efficient)
  'mistral-small-latest':  { inputUsd: 0.000001,  outputUsd: 0.000003 },
}


/**
 * Mistral Provider implementation
 * Normalizes Mistral responses to OpenAI-compatible format
 */
export class MistralProvider implements LLMProvider {
  readonly id = 'mistral' as const
  private client: Mistral
  private circuitBreaker: CircuitBreaker

  constructor(config: ProviderConfig) {
    this.client = new Mistral({
      apiKey: config.apiKey,
    })
    this.circuitBreaker = new CircuitBreaker('mistral')
  }

  /**
   * Non-streaming chat completion
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.circuitBreaker.canRequest()) {
      throw new Error('Mistral circuit breaker is OPEN')
    }

    try {
      const response = await this.client.chat.complete({
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        })),
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        topP: request.top_p,
      })

      this.circuitBreaker.recordSuccess()

      // Mistral API is already OpenAI-compatible!
      const choice = response.choices?.[0]
      const messageContent = choice?.message?.content
      
      return {
        id: response.id || `chatcmpl-mistral-${Date.now()}`,
        object: 'chat.completion',
        created: response.created || Math.floor(Date.now() / 1000),
        model: response.model || request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: typeof messageContent === 'string' ? messageContent : '',
            },
            finish_reason: this.mapFinishReason(choice?.finishReason),
          },
        ],
        usage: {
          prompt_tokens: response.usage?.promptTokens || 0,
          completion_tokens: response.usage?.completionTokens || 0,
          total_tokens: response.usage?.totalTokens || 0,
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
      throw new Error('Mistral circuit breaker is OPEN')
    }

    try {
      const stream = await this.client.chat.stream({
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        })),
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        topP: request.top_p,
      })

      for await (const chunk of stream) {
        this.circuitBreaker.recordSuccess()

        const choice = chunk.data.choices?.[0]
        if (!choice) continue

        // Handle delta content (can be string or array)
        const deltaContent = choice.delta?.content
        const contentStr = typeof deltaContent === 'string' ? deltaContent : undefined

        // Mistral streaming is already OpenAI-compatible!
        yield {
          id: chunk.data.id || `chatcmpl-mistral-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: chunk.data.created || Math.floor(Date.now() / 1000),
          model: chunk.data.model || request.model,
          choices: [
            {
              index: 0,
              delta: {
                role: choice.delta?.role as 'assistant' | undefined,
                content: contentStr ?? undefined,
              },
              finish_reason: this.mapFinishReason(choice.finishReason),
            },
          ],
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
   * Map Mistral finish reason to OpenAI finish_reason
   */
  private mapFinishReason(
    finishReason: string | undefined | null
  ): 'stop' | 'length' | 'content_filter' | 'tool_calls' | null {
    if (!finishReason) return null

    switch (finishReason) {
      case 'stop':
        return 'stop'
      case 'length':
      case 'model_length':
        return 'length'
      case 'tool_calls':
        return 'tool_calls'
      case 'content_filter':
        return 'content_filter'
      default:
        return 'stop'
    }
  }
}
