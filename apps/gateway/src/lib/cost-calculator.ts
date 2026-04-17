/**
 * Cost Calculator
 * 
 * Calculates dollar cost for LLM API calls based on token usage and model pricing.
 * Pricing is hardcoded based on provider documentation as of 2024.
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
  // OpenAI GPT-4o models
  'gpt-4o': {
    inputUsd: 0.0000025,   // $2.50 / 1M tokens
    outputUsd: 0.00001,    // $10.00 / 1M tokens
  },
  'gpt-4o-2024-11-20': {
    inputUsd: 0.0000025,
    outputUsd: 0.00001,
  },
  'gpt-4o-2024-08-06': {
    inputUsd: 0.0000025,
    outputUsd: 0.00001,
  },
  'gpt-4o-2024-05-13': {
    inputUsd: 0.000005,    // $5.00 / 1M tokens
    outputUsd: 0.000015,   // $15.00 / 1M tokens
  },

  // OpenAI GPT-4o-mini models
  'gpt-4o-mini': {
    inputUsd: 0.00000015,  // $0.15 / 1M tokens
    outputUsd: 0.0000006,  // $0.60 / 1M tokens
  },
  'gpt-4o-mini-2024-07-18': {
    inputUsd: 0.00000015,
    outputUsd: 0.0000006,
  },

  // OpenAI GPT-4 Turbo models
  'gpt-4-turbo': {
    inputUsd: 0.00001,     // $10.00 / 1M tokens
    outputUsd: 0.00003,    // $30.00 / 1M tokens
  },
  'gpt-4-turbo-2024-04-09': {
    inputUsd: 0.00001,
    outputUsd: 0.00003,
  },
  'gpt-4-turbo-preview': {
    inputUsd: 0.00001,
    outputUsd: 0.00003,
  },

  // OpenAI GPT-4 models
  'gpt-4': {
    inputUsd: 0.00003,     // $30.00 / 1M tokens
    outputUsd: 0.00006,    // $60.00 / 1M tokens
  },
  'gpt-4-0613': {
    inputUsd: 0.00003,
    outputUsd: 0.00006,
  },

  // OpenAI GPT-3.5 Turbo models
  'gpt-3.5-turbo': {
    inputUsd: 0.0000005,   // $0.50 / 1M tokens
    outputUsd: 0.0000015,  // $1.50 / 1M tokens
  },
  'gpt-3.5-turbo-0125': {
    inputUsd: 0.0000005,
    outputUsd: 0.0000015,
  },

  // Anthropic Claude 3.5 Sonnet
  'claude-3-5-sonnet-20241022': {
    inputUsd: 0.000003,    // $3.00 / 1M tokens
    outputUsd: 0.000015,   // $15.00 / 1M tokens
  },
  'claude-3-5-sonnet-20240620': {
    inputUsd: 0.000003,
    outputUsd: 0.000015,
  },

  // Anthropic Claude 3 Opus
  'claude-3-opus-20240229': {
    inputUsd: 0.000015,    // $15.00 / 1M tokens
    outputUsd: 0.000075,   // $75.00 / 1M tokens
  },

  // Anthropic Claude 3 Sonnet
  'claude-3-sonnet-20240229': {
    inputUsd: 0.000003,    // $3.00 / 1M tokens
    outputUsd: 0.000015,   // $15.00 / 1M tokens
  },

  // Anthropic Claude 3 Haiku
  'claude-3-haiku-20240307': {
    inputUsd: 0.00000025,  // $0.25 / 1M tokens
    outputUsd: 0.00000125, // $1.25 / 1M tokens
  },

  // Google Gemini 1.5 Pro
  'gemini-1.5-pro': {
    inputUsd: 0.00000125,  // $1.25 / 1M tokens (prompt < 128K)
    outputUsd: 0.000005,   // $5.00 / 1M tokens
  },
  'gemini-1.5-pro-002': {
    inputUsd: 0.00000125,
    outputUsd: 0.000005,
  },
  'gemini-1.5-pro-001': {
    inputUsd: 0.00000125,
    outputUsd: 0.000005,
  },

  // Google Gemini 1.5 Flash
  'gemini-1.5-flash': {
    inputUsd: 0.000000075, // $0.075 / 1M tokens (prompt < 128K)
    outputUsd: 0.0000003,  // $0.30 / 1M tokens
  },
  'gemini-1.5-flash-002': {
    inputUsd: 0.000000075,
    outputUsd: 0.0000003,
  },
  'gemini-1.5-flash-001': {
    inputUsd: 0.000000075,
    outputUsd: 0.0000003,
  },

  // Google Gemini 1.0 Pro
  'gemini-1.0-pro': {
    inputUsd: 0.0000005,   // $0.50 / 1M tokens
    outputUsd: 0.0000015,  // $1.50 / 1M tokens
  },
  'gemini-1.0-pro-001': {
    inputUsd: 0.0000005,
    outputUsd: 0.0000015,
  },

  // Cohere Command R+
  'command-r-plus': {
    inputUsd: 0.000003,    // $3.00 / 1M tokens
    outputUsd: 0.000015,   // $15.00 / 1M tokens
  },
  'command-r-plus-08-2024': {
    inputUsd: 0.000003,
    outputUsd: 0.000015,
  },

  // Cohere Command R
  'command-r': {
    inputUsd: 0.0000005,   // $0.50 / 1M tokens
    outputUsd: 0.0000015,  // $1.50 / 1M tokens
  },
  'command-r-08-2024': {
    inputUsd: 0.0000005,
    outputUsd: 0.0000015,
  },

  // Cohere Command
  'command': {
    inputUsd: 0.000001,    // $1.00 / 1M tokens
    outputUsd: 0.000002,   // $2.00 / 1M tokens
  },

  // Cohere Command Light
  'command-light': {
    inputUsd: 0.0000003,   // $0.30 / 1M tokens
    outputUsd: 0.0000006,  // $0.60 / 1M tokens
  },

  // Mistral Large
  'mistral-large-latest': {
    inputUsd: 0.000003,    // $3.00 / 1M tokens
    outputUsd: 0.000009,   // $9.00 / 1M tokens
  },
  'mistral-large-2411': {
    inputUsd: 0.000003,
    outputUsd: 0.000009,
  },
  'mistral-large-2407': {
    inputUsd: 0.000003,
    outputUsd: 0.000009,
  },

  // Mistral Medium
  'mistral-medium-latest': {
    inputUsd: 0.0000027,   // $2.70 / 1M tokens
    outputUsd: 0.0000081,  // $8.10 / 1M tokens
  },

  // Mistral Small
  'mistral-small-latest': {
    inputUsd: 0.000001,    // $1.00 / 1M tokens
    outputUsd: 0.000003,   // $3.00 / 1M tokens
  },
  'mistral-small-2409': {
    inputUsd: 0.000001,
    outputUsd: 0.000003,
  },

  // Mistral Nemo
  'open-mistral-nemo': {
    inputUsd: 0.0000003,   // $0.30 / 1M tokens
    outputUsd: 0.0000003,  // $0.30 / 1M tokens
  },
  'open-mistral-nemo-2407': {
    inputUsd: 0.0000003,
    outputUsd: 0.0000003,
  },

  // Mistral 7B
  'open-mistral-7b': {
    inputUsd: 0.00000025,  // $0.25 / 1M tokens
    outputUsd: 0.00000025, // $0.25 / 1M tokens
  },

  // Mixtral 8x7B
  'open-mixtral-8x7b': {
    inputUsd: 0.0000007,   // $0.70 / 1M tokens
    outputUsd: 0.0000007,  // $0.70 / 1M tokens
  },

  // Mixtral 8x22B
  'open-mixtral-8x22b': {
    inputUsd: 0.000002,    // $2.00 / 1M tokens
    outputUsd: 0.000006,   // $6.00 / 1M tokens
  },

  // Codestral
  'codestral-latest': {
    inputUsd: 0.000001,    // $1.00 / 1M tokens
    outputUsd: 0.000003,   // $3.00 / 1M tokens
  },
  'codestral-2405': {
    inputUsd: 0.000001,
    outputUsd: 0.000003,
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
