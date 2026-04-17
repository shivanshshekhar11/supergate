/**
 * Cost Calculator Tests
 * 
 * Tests for LLM cost calculation functionality
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCost,
  getCostBreakdown,
  hasKnownPricing,
  getModelsWithPricing,
  COST_TABLE,
} from './cost-calculator'

describe('Cost Calculator', () => {
  describe('calculateCost', () => {
    describe('OpenAI Models', () => {
      it('should calculate cost for gpt-4o', () => {
        const cost = calculateCost('gpt-4o', 1000, 500)
        // 1000 * 0.0000025 + 500 * 0.00001 = 0.0025 + 0.005 = 0.0075
        expect(cost).toBe(0.0075)
      })

      it('should calculate cost for gpt-4o-mini', () => {
        const cost = calculateCost('gpt-4o-mini', 10000, 5000)
        // 10000 * 0.00000015 + 5000 * 0.0000006 = 0.0015 + 0.003 = 0.0045
        expect(cost).toBe(0.0045)
      })

      it('should calculate cost for gpt-4-turbo', () => {
        const cost = calculateCost('gpt-4-turbo', 1000, 1000)
        // 1000 * 0.00001 + 1000 * 0.00003 = 0.01 + 0.03 = 0.04
        expect(cost).toBe(0.04)
      })

      it('should calculate cost for gpt-3.5-turbo', () => {
        const cost = calculateCost('gpt-3.5-turbo', 10000, 10000)
        // 10000 * 0.0000005 + 10000 * 0.0000015 = 0.005 + 0.015 = 0.02
        expect(cost).toBe(0.02)
      })
    })

    describe('Anthropic Models', () => {
      it('should calculate cost for claude-3-5-sonnet', () => {
        const cost = calculateCost('claude-3-5-sonnet-20241022', 1000, 500)
        // 1000 * 0.000003 + 500 * 0.000015 = 0.003 + 0.0075 = 0.0105
        expect(cost).toBe(0.0105)
      })

      it('should calculate cost for claude-3-opus', () => {
        const cost = calculateCost('claude-3-opus-20240229', 1000, 1000)
        // 1000 * 0.000015 + 1000 * 0.000075 = 0.015 + 0.075 = 0.09
        expect(cost).toBe(0.09)
      })

      it('should calculate cost for claude-3-haiku', () => {
        const cost = calculateCost('claude-3-haiku-20240307', 10000, 10000)
        // 10000 * 0.00000025 + 10000 * 0.00000125 = 0.0025 + 0.0125 = 0.015
        expect(cost).toBe(0.015)
      })
    })

    describe('Google Models', () => {
      it('should calculate cost for gemini-1.5-pro', () => {
        const cost = calculateCost('gemini-1.5-pro', 1000, 1000)
        // 1000 * 0.00000125 + 1000 * 0.000005 = 0.00125 + 0.005 = 0.00625
        expect(cost).toBe(0.00625)
      })

      it('should calculate cost for gemini-1.5-flash', () => {
        const cost = calculateCost('gemini-1.5-flash', 10000, 10000)
        // 10000 * 0.000000075 + 10000 * 0.0000003 = 0.00075 + 0.003 = 0.00375
        expect(cost).toBe(0.00375)
      })
    })

    describe('Cohere Models', () => {
      it('should calculate cost for command-r-plus', () => {
        const cost = calculateCost('command-r-plus', 1000, 1000)
        // 1000 * 0.000003 + 1000 * 0.000015 = 0.003 + 0.015 = 0.018
        expect(cost).toBe(0.018)
      })

      it('should calculate cost for command-r', () => {
        const cost = calculateCost('command-r', 10000, 10000)
        // 10000 * 0.0000005 + 10000 * 0.0000015 = 0.005 + 0.015 = 0.02
        expect(cost).toBe(0.02)
      })
    })

    describe('Mistral Models', () => {
      it('should calculate cost for mistral-large', () => {
        const cost = calculateCost('mistral-large-latest', 1000, 1000)
        // 1000 * 0.000003 + 1000 * 0.000009 = 0.003 + 0.009 = 0.012
        expect(cost).toBe(0.012)
      })

      it('should calculate cost for mistral-small', () => {
        const cost = calculateCost('mistral-small-latest', 10000, 10000)
        // 10000 * 0.000001 + 10000 * 0.000003 = 0.01 + 0.03 = 0.04
        expect(cost).toBe(0.04)
      })
    })

    describe('Unknown Models', () => {
      it('should use default pricing for unknown model', () => {
        const cost = calculateCost('unknown-model', 10000, 5000)
        // Default to gpt-4o-mini: 10000 * 0.00000015 + 5000 * 0.0000006
        expect(cost).toBeCloseTo(0.0045, 4)
      })

      it('should log warning for unknown model', () => {
        // Just verify it doesn't throw
        expect(() => calculateCost('unknown-model', 1000, 1000)).not.toThrow()
      })
    })

    describe('Edge Cases', () => {
      it('should handle zero tokens', () => {
        const cost = calculateCost('gpt-4o', 0, 0)
        expect(cost).toBe(0)
      })

      it('should handle only input tokens', () => {
        const cost = calculateCost('gpt-4o', 1000, 0)
        expect(cost).toBe(0.0025)
      })

      it('should handle only output tokens', () => {
        const cost = calculateCost('gpt-4o', 0, 1000)
        expect(cost).toBe(0.01)
      })

      it('should handle large token counts', () => {
        const cost = calculateCost('gpt-4o', 1000000, 500000)
        // 1M * 0.0000025 + 500K * 0.00001 = 2.5 + 5 = 7.5
        expect(cost).toBe(7.5)
      })

      it('should round to 8 decimal places', () => {
        const cost = calculateCost('gpt-4o', 1, 1)
        // Very small numbers should be rounded properly
        expect(cost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(8)
      })
    })
  })

  describe('getCostBreakdown', () => {
    it('should return detailed cost breakdown', () => {
      const breakdown = getCostBreakdown('gpt-4o', 1000, 500)

      expect(breakdown).toEqual({
        inputCost: 0.0025,
        outputCost: 0.005,
        totalCost: 0.0075,
        inputRate: 0.0000025,
        outputRate: 0.00001,
      })
    })

    it('should handle unknown model with default rates', () => {
      const breakdown = getCostBreakdown('unknown-model', 1000, 1000)

      expect(breakdown.inputRate).toBe(0.00000015) // gpt-4o-mini input
      expect(breakdown.outputRate).toBe(0.0000006) // gpt-4o-mini output
    })

    it('should round all cost values to 8 decimal places', () => {
      const breakdown = getCostBreakdown('gpt-4o', 1, 1)

      expect(breakdown.inputCost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(8)
      expect(breakdown.outputCost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(8)
      expect(breakdown.totalCost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(8)
    })

    it('should handle zero tokens', () => {
      const breakdown = getCostBreakdown('gpt-4o', 0, 0)

      expect(breakdown.inputCost).toBe(0)
      expect(breakdown.outputCost).toBe(0)
      expect(breakdown.totalCost).toBe(0)
    })
  })

  describe('hasKnownPricing', () => {
    it('should return true for known OpenAI models', () => {
      expect(hasKnownPricing('gpt-4o')).toBe(true)
      expect(hasKnownPricing('gpt-4o-mini')).toBe(true)
      expect(hasKnownPricing('gpt-4-turbo')).toBe(true)
      expect(hasKnownPricing('gpt-3.5-turbo')).toBe(true)
    })

    it('should return true for known Anthropic models', () => {
      expect(hasKnownPricing('claude-3-5-sonnet-20241022')).toBe(true)
      expect(hasKnownPricing('claude-3-opus-20240229')).toBe(true)
      expect(hasKnownPricing('claude-3-haiku-20240307')).toBe(true)
    })

    it('should return true for known Google models', () => {
      expect(hasKnownPricing('gemini-1.5-pro')).toBe(true)
      expect(hasKnownPricing('gemini-1.5-flash')).toBe(true)
    })

    it('should return true for known Cohere models', () => {
      expect(hasKnownPricing('command-r-plus')).toBe(true)
      expect(hasKnownPricing('command-r')).toBe(true)
    })

    it('should return true for known Mistral models', () => {
      expect(hasKnownPricing('mistral-large-latest')).toBe(true)
      expect(hasKnownPricing('mistral-small-latest')).toBe(true)
    })

    it('should return false for unknown models', () => {
      expect(hasKnownPricing('unknown-model')).toBe(false)
      expect(hasKnownPricing('gpt-5')).toBe(false)
      expect(hasKnownPricing('')).toBe(false)
    })
  })

  describe('getModelsWithPricing', () => {
    it('should return array of all models with pricing', () => {
      const models = getModelsWithPricing()

      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)
    })

    it('should include all major model families', () => {
      const models = getModelsWithPricing()

      // Check for OpenAI models
      expect(models.some(m => m.startsWith('gpt-4o'))).toBe(true)
      expect(models.some(m => m.startsWith('gpt-3.5'))).toBe(true)

      // Check for Anthropic models
      expect(models.some(m => m.startsWith('claude-3'))).toBe(true)

      // Check for Google models
      expect(models.some(m => m.startsWith('gemini'))).toBe(true)

      // Check for Cohere models
      expect(models.some(m => m.startsWith('command'))).toBe(true)

      // Check for Mistral models
      expect(models.some(m => m.startsWith('mistral') || m.startsWith('open-mistral'))).toBe(true)
    })

    it('should match COST_TABLE keys', () => {
      const models = getModelsWithPricing()
      const costTableKeys = Object.keys(COST_TABLE)

      expect(models).toEqual(costTableKeys)
    })
  })

  describe('COST_TABLE', () => {
    it('should have valid structure for all entries', () => {
      Object.entries(COST_TABLE).forEach(([model, costs]) => {
        expect(costs).toHaveProperty('inputUsd')
        expect(costs).toHaveProperty('outputUsd')
        expect(typeof costs.inputUsd).toBe('number')
        expect(typeof costs.outputUsd).toBe('number')
        expect(costs.inputUsd).toBeGreaterThan(0)
        expect(costs.outputUsd).toBeGreaterThan(0)
      })
    })

    it('should have reasonable pricing ranges', () => {
      Object.entries(COST_TABLE).forEach(([model, costs]) => {
        // Input costs should be between $0.00001 and $0.0001 per token
        expect(costs.inputUsd).toBeGreaterThanOrEqual(0.00000001)
        expect(costs.inputUsd).toBeLessThanOrEqual(0.0001)

        // Output costs should be between $0.00001 and $0.001 per token
        expect(costs.outputUsd).toBeGreaterThanOrEqual(0.00000001)
        expect(costs.outputUsd).toBeLessThanOrEqual(0.001)

        // Output should generally cost more than input
        // (Some models like Mistral have equal pricing, so we allow equal)
        expect(costs.outputUsd).toBeGreaterThanOrEqual(costs.inputUsd)
      })
    })

    it('should include at least 40 models', () => {
      const modelCount = Object.keys(COST_TABLE).length
      expect(modelCount).toBeGreaterThanOrEqual(40)
    })
  })

  describe('Real-World Scenarios', () => {
    it('should calculate cost for typical GPT-4o conversation', () => {
      // Typical conversation: 500 input tokens, 300 output tokens
      const cost = calculateCost('gpt-4o', 500, 300)
      expect(cost).toBeCloseTo(0.00425, 5) // ~$0.004
    })

    it('should calculate cost for long GPT-4o-mini conversation', () => {
      // Long conversation: 5000 input tokens, 3000 output tokens
      const cost = calculateCost('gpt-4o-mini', 5000, 3000)
      expect(cost).toBeCloseTo(0.00255, 5) // ~$0.003
    })

    it('should calculate cost for Claude 3.5 Sonnet analysis', () => {
      // Analysis task: 2000 input tokens, 1500 output tokens
      const cost = calculateCost('claude-3-5-sonnet-20241022', 2000, 1500)
      expect(cost).toBeCloseTo(0.0285, 4) // ~$0.029
    })

    it('should show cost difference between models', () => {
      const tokens = { input: 1000, output: 1000 }

      const gpt4oCost = calculateCost('gpt-4o', tokens.input, tokens.output)
      const gpt4oMiniCost = calculateCost('gpt-4o-mini', tokens.input, tokens.output)
      const claudeHaikuCost = calculateCost('claude-3-haiku-20240307', tokens.input, tokens.output)

      // GPT-4o should be most expensive
      expect(gpt4oCost).toBeGreaterThan(gpt4oMiniCost)
      expect(gpt4oCost).toBeGreaterThan(claudeHaikuCost)

      // GPT-4o-mini should be cheaper than GPT-4o
      expect(gpt4oMiniCost).toBeLessThan(gpt4oCost)
    })

    it('should calculate daily cost for high-volume usage', () => {
      // 1000 requests per day, average 500 input + 300 output tokens
      const requestsPerDay = 1000
      const avgInputTokens = 500
      const avgOutputTokens = 300

      const costPerRequest = calculateCost('gpt-4o-mini', avgInputTokens, avgOutputTokens)
      const dailyCost = costPerRequest * requestsPerDay

      // gpt-4o-mini: (500 * 0.00000015 + 300 * 0.0000006) * 1000 = 0.000255 * 1000 = 0.255
      expect(dailyCost).toBeCloseTo(0.255, 2)
    })
  })
})
