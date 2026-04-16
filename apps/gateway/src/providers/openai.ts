import OpenAI from 'openai'
import { ChatRequest, ChatResponse, ChatStreamChunk } from '@llm-gateway/schemas'
import { LLMProvider, ProviderConfig } from './types'
import { CircuitBreaker } from '../lib/circuit-breaker'

/**
 * OpenAI cost table (USD per token)
 * Updated: 2024-04
 */
const COST_TABLE: Record<string, { inputUsd: number; outputUsd: number }> = {
  'gpt-4o': { inputUsd: 0.0000025, outputUsd: 0.00001 },
  'gpt-4o-mini': { inputUsd: 0.00000015, outputUsd: 0.0000006 },
  'gpt-4o-2024-11-20': { inputUsd: 0.0000025, outputUsd: 0.00001 },
  'gpt-4o-2024-08-06': { inputUsd: 0.0000025, outputUsd: 0.00001 },
  'gpt-4o-2024-05-13': { inputUsd: 0.000005, outputUsd: 0.000015 },
  'gpt-4-turbo': { inputUsd: 0.00001, outputUsd: 0.00003 },
  'gpt-4': { inputUsd: 0.00003, outputUsd: 0.00006 },
  'gpt-3.5-turbo': { inputUsd: 0.0000005, outputUsd: 0.0000015 },
  'gpt-3.5-turbo-0125': { inputUsd: 0.0000005, outputUsd: 0.0000015 },
}

/**
 * OpenAI Provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const
  private client: OpenAI
  private circuitBreaker: CircuitBreaker

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
    })
    this.circuitBreaker = new CircuitBreaker('openai')
  }

  /**
   * Non-streaming chat completion
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.circuitBreaker.canRequest()) {
      throw new Error('OpenAI circuit breaker is OPEN')
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages as any,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stream: false,
      })

      this.circuitBreaker.recordSuccess()

      // OpenAI response is already in the correct format
      return {
        id: completion.id,
        object: 'chat.completion',
        created: completion.created,
        model: completion.model,
        choices: completion.choices.map((choice) => ({
          index: choice.index,
          message: {
            role: choice.message.role as 'system' | 'user' | 'assistant',
            content: choice.message.content || '',
          },
          finish_reason: choice.finish_reason as any,
        })),
        usage: {
          prompt_tokens: completion.usage?.prompt_tokens || 0,
          completion_tokens: completion.usage?.completion_tokens || 0,
          total_tokens: completion.usage?.total_tokens || 0,
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
      throw new Error('OpenAI circuit breaker is OPEN')
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages as any,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stream: true,
      })

      for await (const chunk of stream) {
        this.circuitBreaker.recordSuccess()

        yield {
          id: chunk.id,
          object: 'chat.completion.chunk',
          created: chunk.created,
          model: chunk.model,
          choices: chunk.choices.map((choice) => ({
            index: choice.index,
            delta: {
              role: choice.delta.role as 'system' | 'user' | 'assistant' | undefined,
              content: choice.delta.content ?? undefined, // Convert null to undefined
            },
            finish_reason: choice.finish_reason as any,
          })),
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
}
