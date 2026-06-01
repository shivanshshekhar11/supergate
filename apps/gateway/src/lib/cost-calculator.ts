/**
 * Cost Calculator
 * 
 * Calculates dollar cost for LLM API calls based on token usage and model pricing.
 * Pricing is hardcoded based on provider documentation as of 2026.
 * 
 * Prices are in USD per token.
 */

export interface ModelCost {
  inputUsd: number   // Cost per input token
  outputUsd: number  // Cost per output token
}

/**
 * Cost table for all supported models
 * Prices are per token (not per 1K tokens)
 */
export const COST_TABLE: Record<string, ModelCost> = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  'gpt-4o': {
    inputUsd: 0.0000025,   // $2.50 / 1M tokens
    outputUsd: 0.000010,   // $10.00 / 1M tokens
  },
  'gpt-4o-mini': {
    inputUsd: 0.00000015,  // $0.15 / 1M tokens
    outputUsd: 0.0000006,  // $0.60 / 1M tokens
  },
  'gpt-4.1': {
    inputUsd: 0.000002,    // $2.00 / 1M tokens
    outputUsd: 0.000008,   // $8.00 / 1M tokens
  },
  'gpt-4.1-nano': {
    inputUsd: 0.0000001,   // $0.10 / 1M tokens
    outputUsd: 0.0000004,  // $0.40 / 1M tokens
  },

  // ── Anthropic Claude 4.x Series ─────────────────────────────────────────
  'claude-opus-4-8': {
    inputUsd: 0.000005,    // $5.00 / 1M tokens
    outputUsd: 0.000025,   // $25.00 / 1M tokens
  },
  'claude-sonnet-4-6': {
    inputUsd: 0.000003,    // $3.00 / 1M tokens
    outputUsd: 0.000015,   // $15.00 / 1M tokens
  },
  'claude-haiku-4-5': {
    inputUsd: 0.000001,    // $1.00 / 1M tokens
    outputUsd: 0.000005,   // $5.00 / 1M tokens
  },

  // ── Google Gemini 2.5 Series (GA) ────────────────────────────────────────
  'gemini-2.5-pro': {
    inputUsd: 0.00000125,  // $1.25 / 1M tokens
    outputUsd: 0.000010,   // $10.00 / 1M tokens
  },
  'gemini-2.5-flash': {
    inputUsd: 0.0000003,   // $0.30 / 1M tokens
    outputUsd: 0.0000025,  // $2.50 / 1M tokens
  },
  'gemini-2.5-flash-lite': {
    inputUsd: 0.0000001,   // $0.10 / 1M tokens
    outputUsd: 0.0000004,  // $0.40 / 1M tokens
  },

  // ── Cohere Command A Series ──────────────────────────────────────────────
  'command-a-03-2025': {
    inputUsd: 0.0000025,   // $2.50 / 1M tokens
    outputUsd: 0.000010,   // $10.00 / 1M tokens
  },
  'command-r7b-12-2024': {
    inputUsd: 0.0000000375, // $0.0375 / 1M tokens
    outputUsd: 0.00000015,  // $0.15 / 1M tokens
  },

  // ── Mistral 2025/2026 Lineup ─────────────────────────────────────────────
  'mistral-large-latest': {
    inputUsd: 0.000003,    // $3.00 / 1M tokens
    outputUsd: 0.000009,   // $9.00 / 1M tokens
  },
  'mistral-medium-latest': {
    inputUsd: 0.0000027,   // $2.70 / 1M tokens
    outputUsd: 0.0000081,  // $8.10 / 1M tokens
  },
  'mistral-small-latest': {
    inputUsd: 0.000001,    // $1.00 / 1M tokens
    outputUsd: 0.000003,   // $3.00 / 1M tokens
  },
  'codestral-latest': {
    inputUsd: 0.000001,    // $1.00 / 1M tokens
    outputUsd: 0.000003,   // $3.00 / 1M tokens
  },
}

/**
 * Calculate cost for a request
 * 
 * @param model - Model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = COST_TABLE[model]

  if (!costs) {
    console.warn(`[CostCalculator] Unknown model: ${model}, using default cost`)
    // Default to GPT-4o-mini pricing for unknown models
    return (inputTokens * 0.00000015) + (outputTokens * 0.0000006)
  }

  const inputCost = inputTokens * costs.inputUsd
  const outputCost = outputTokens * costs.outputUsd
  const totalCost = inputCost + outputCost

  return Math.round(totalCost * 100000000) / 100000000 // Round to 8 decimal places
}

/**
 * Get cost breakdown for a request
 */
export function getCostBreakdown(
  model: string,
  inputTokens: number,
  outputTokens: number
): {
  inputCost: number
  outputCost: number
  totalCost: number
  inputRate: number
  outputRate: number
} {
  const costs = COST_TABLE[model] || {
    inputUsd: 0.00000015,
    outputUsd: 0.0000006,
  }

  const inputCost = inputTokens * costs.inputUsd
  const outputCost = outputTokens * costs.outputUsd
  const totalCost = inputCost + outputCost

  return {
    inputCost: Math.round(inputCost * 100000000) / 100000000,
    outputCost: Math.round(outputCost * 100000000) / 100000000,
    totalCost: Math.round(totalCost * 100000000) / 100000000,
    inputRate: costs.inputUsd,
    outputRate: costs.outputUsd,
  }
}

/**
 * Check if model has known pricing
 */
export function hasKnownPricing(model: string): boolean {
  return model in COST_TABLE
}

/**
 * Get all models with known pricing
 */
export function getModelsWithPricing(): string[] {
  return Object.keys(COST_TABLE)
}
