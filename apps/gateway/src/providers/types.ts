import { ChatRequest, ChatResponse, ChatStreamChunk } from '@llm-gateway/schemas'

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open'
  failures: number
  lastFailure: string | null
  nextRetry: string | null
}

/**
 * LLM Provider interface
 * All providers (OpenAI, Anthropic) must implement this interface
 */
export interface LLMProvider {
  /** Provider identifier */
  id: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral'

  /**
   * Non-streaming chat completion
   * Returns a complete response
   */
  chat(request: ChatRequest): Promise<ChatResponse>

  /**
   * Streaming chat completion
   * Yields chunks as they arrive via SSE
   */
  stream(request: ChatRequest): AsyncIterable<ChatStreamChunk>

  /**
   * List of models supported by this provider
   */
  modelsSupported(): string[]

  /**
   * Get cost per token for a specific model
   * Returns input and output costs in USD
   */
  costPerToken(model: string): { inputUsd: number; outputUsd: number } | null

  /**
   * Get circuit breaker state for health checks
   */
  getCircuitBreakerState(): CircuitBreakerState
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey: string
}
