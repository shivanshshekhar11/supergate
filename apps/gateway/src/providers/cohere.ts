import { CohereClient } from 'cohere-ai'
import { ChatRequest, ChatResponse, ChatStreamChunk } from '@llm-gateway/schemas'
import { LLMProvider, ProviderConfig } from './types'
import { CircuitBreaker } from '../lib/circuit-breaker'

/**
 * Cohere cost table (USD per token)
 * Updated: 2024-12
 * Source: https://cohere.com/pricing
 */
const COST_TABLE: Record<string, { inputUsd: number; outputUsd: number }> = {
  // Command R+ (most capable)
  'command-r-plus': { inputUsd: 0.000003, outputUsd: 0.000015 },
  'command-r-plus-08-2024': { inputUsd: 0.000003, outputUsd: 0.000015 },
  
  // Command R (balanced)
  'command-r': { inputUsd: 0.0000005, outputUsd: 0.0000015 },
  'command-r-08-2024': { inputUsd: 0.0000005, outputUsd: 0.0000015 },
  
  // Command (legacy)
  'command': { inputUsd: 0.000001, outputUsd: 0.000002 },
  'command-light': { inputUsd: 0.0000003, outputUsd: 0.0000006 },
  
  // Command Nightly (experimental)
  'command-nightly': { inputUsd: 0.000001, outputUsd: 0.000002 },
  'command-light-nightly': { inputUsd: 0.0000003, outputUsd: 0.0000006 },
}

/**
 * Cohere Provider implementation
 * Normalizes Cohere responses to OpenAI-compatible format
 */
export class CohereProvider implements LLMProvider {
  readonly id = 'cohere' as const
  private client: CohereClient
  private circuitBreaker: CircuitBreaker

  constructor(config: ProviderConfig) {
    this.client = new CohereClient({
      token: config.apiKey,
    })
    this.circuitBreaker = new CircuitBreaker('cohere')
  }

  /**
   * Non-streaming chat completion
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.circuitBreaker.canRequest()) {
      throw new Error('Cohere circuit breaker is OPEN')
    }

    try {
      // Convert OpenAI messages to Cohere format
      const { preamble, chatHistory, message } = this.convertMessages(request.messages)

      const response = await this.client.chat({
        model: request.model,
        message,
        chatHistory,
        preamble,
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        p: request.top_p,
      })

      this.circuitBreaker.recordSuccess()

      // Normalize to OpenAI format
      return {
        id: response.generationId || `chatcmpl-cohere-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: response.text,
            },
            finish_reason: this.mapFinishReason(response.finishReason),
          },
        ],
        usage: {
          prompt_tokens: response.meta?.tokens?.inputTokens || 0,
          completion_tokens: response.meta?.tokens?.outputTokens || 0,
          total_tokens:
            (response.meta?.tokens?.inputTokens || 0) +
            (response.meta?.tokens?.outputTokens || 0),
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
      throw new Error('Cohere circuit breaker is OPEN')
    }

    try {
      // Convert OpenAI messages to Cohere format
      const { preamble, chatHistory, message } = this.convertMessages(request.messages)

      const stream = await this.client.chatStream({
        model: request.model,
        message,
        chatHistory,
        preamble,
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        p: request.top_p,
      })

      const id = `chatcmpl-cohere-${Date.now()}`
      const created = Math.floor(Date.now() / 1000)
      let isFirstChunk = true

      for await (const chunk of stream) {
        this.circuitBreaker.recordSuccess()

        // Cohere streams different event types
        if (chunk.eventType === 'text-generation') {
          if (isFirstChunk) {
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
                    content: chunk.text,
                  },
                  finish_reason: null,
                },
              ],
            }
            isFirstChunk = false
          } else {
            // Subsequent chunks with content
            yield {
              id,
              object: 'chat.completion.chunk',
              created,
              model: request.model,
              choices: [
                {
                  index: 0,
                  delta: {
                    content: chunk.text,
                  },
                  finish_reason: null,
                },
              ],
            }
          }
        } else if (chunk.eventType === 'stream-end') {
          // Final chunk with finish reason
          yield {
            id,
            object: 'chat.completion.chunk',
            created,
            model: request.model,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: this.mapFinishReason(chunk.finishReason),
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
   * Convert OpenAI messages to Cohere format
   */
  private convertMessages(messages: Array<{ role: string; content: string }>) {
    // Extract system message (preamble in Cohere)
    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages.filter((m) => m.role !== 'system')

    // Last message is the current message
    const lastMessage = conversationMessages[conversationMessages.length - 1]
    const historyMessages = conversationMessages.slice(0, -1)

    // Convert history to Cohere format
    const chatHistory = historyMessages.map((msg) => ({
      role: msg.role === 'assistant' ? ('CHATBOT' as const) : ('USER' as const),
      message: msg.content,
    }))

    return {
      preamble: systemMessage?.content,
      chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
      message: lastMessage.content,
    }
  }

  /**
   * Map Cohere finish reason to OpenAI finish_reason
   */
  private mapFinishReason(
    finishReason: string | undefined
  ): 'stop' | 'length' | 'content_filter' | 'tool_calls' | null {
    if (!finishReason) return 'stop'

    switch (finishReason) {
      case 'COMPLETE':
        return 'stop'
      case 'MAX_TOKENS':
        return 'length'
      case 'ERROR':
      case 'ERROR_TOXIC':
        return 'content_filter'
      case 'USER_CANCEL':
      case 'ERROR_LIMIT':
      default:
        return 'stop'
    }
  }
}
