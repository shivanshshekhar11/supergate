import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import { ChatRequest, ChatResponse, ChatStreamChunk } from '@llm-gateway/schemas'
import { LLMProvider, ProviderConfig } from './types'
import { CircuitBreaker } from '../lib/circuit-breaker'

/**
 * Google Gemini cost table (USD per token) — June 2026 (2.5 GA series)
 * Source: https://ai.google.dev/pricing
 */
const COST_TABLE: Record<string, { inputUsd: number; outputUsd: number }> = {
  // Gemini 2.5 Pro (best quality)
  'gemini-2.5-pro':        { inputUsd: 0.00000125, outputUsd: 0.000010 },
  // Gemini 2.5 Flash (fast, cheap)
  'gemini-2.5-flash':      { inputUsd: 0.0000003,  outputUsd: 0.0000025 },
  // Gemini 2.5 Flash-Lite (ultra-cheap)
  'gemini-2.5-flash-lite': { inputUsd: 0.0000001,  outputUsd: 0.0000004 },
}


/**
 * Google Gemini Provider implementation
 * Normalizes Google Gemini responses to OpenAI-compatible format
 */
export class GoogleProvider implements LLMProvider {
  readonly id = 'google' as const
  private client: GoogleGenerativeAI
  private circuitBreaker: CircuitBreaker

  constructor(config: ProviderConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey)
    this.circuitBreaker = new CircuitBreaker('google')
  }

  /**
   * Non-streaming chat completion
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.circuitBreaker.canRequest()) {
      throw new Error('Google circuit breaker is OPEN')
    }

    try {
      const model = this.client.getGenerativeModel({ model: request.model })

      // Convert OpenAI messages to Google format
      const { systemInstruction, contents } = this.convertMessages(request.messages)

      // Generate content
      const result = await model.generateContent({
        contents,
        systemInstruction,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.max_tokens,
          topP: request.top_p,
        },
      })

      this.circuitBreaker.recordSuccess()

      const response = result.response
      const text = response.text()

      // Normalize to OpenAI format
      return {
        id: `chatcmpl-google-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: text,
            },
            finish_reason: this.mapFinishReason(response.candidates?.[0]?.finishReason),
          },
        ],
        usage: {
          prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
          completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: response.usageMetadata?.totalTokenCount || 0,
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
      throw new Error('Google circuit breaker is OPEN')
    }

    try {
      const model = this.client.getGenerativeModel({ model: request.model })

      // Convert OpenAI messages to Google format
      const { systemInstruction, contents } = this.convertMessages(request.messages)

      // Generate content stream
      const result = await model.generateContentStream({
        contents,
        systemInstruction,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.max_tokens,
          topP: request.top_p,
        },
      })

      const id = `chatcmpl-google-${Date.now()}`
      const created = Math.floor(Date.now() / 1000)
      let isFirstChunk = true

      for await (const chunk of result.stream) {
        this.circuitBreaker.recordSuccess()

        const text = chunk.text()

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
                  content: text,
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
                  content: text,
                },
                finish_reason: null,
              },
            ],
          }
        }
      }

      // Final chunk with finish reason
      const finalResponse = await result.response
      yield {
        id,
        object: 'chat.completion.chunk',
        created,
        model: request.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: this.mapFinishReason(finalResponse.candidates?.[0]?.finishReason),
          },
        ],
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
   * Convert OpenAI messages to Google format
   */
  private convertMessages(messages: Array<{ role: string; content: string }>) {
    // Extract system message if present
    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages.filter((m) => m.role !== 'system')

    // Convert to Google format
    const contents = conversationMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }))

    return {
      systemInstruction: systemMessage ? systemMessage.content : undefined,
      contents,
    }
  }

  /**
   * Map Google finish reason to OpenAI finish_reason
   */
  private mapFinishReason(
    finishReason: string | undefined
  ): 'stop' | 'length' | 'content_filter' | 'tool_calls' | null {
    if (!finishReason) return 'stop'

    switch (finishReason) {
      case 'STOP':
        return 'stop'
      case 'MAX_TOKENS':
        return 'length'
      case 'SAFETY':
      case 'RECITATION':
        return 'content_filter'
      case 'OTHER':
      default:
        return 'stop'
    }
  }
}
