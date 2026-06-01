import { env } from '../config'
import { getTenantLLMKey, getTenantTier } from '../lib/tenant-keys'
import { LLMProvider } from './types'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'
import { GoogleProvider } from './google'
import { CohereProvider } from './cohere'
import { MistralProvider } from './mistral'

/**
 * Model to provider mapping — updated June 2026
 * Maps every supported model ID to its provider
 */
const MODEL_TO_PROVIDER: Record<string, 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral'> = {
  // ── OpenAI ──────────────────────────────────────────────────────────────
  'gpt-4o':        'openai',
  'gpt-4o-mini':   'openai',
  'gpt-4.1':       'openai',
  'gpt-4.1-nano':  'openai',

  // ── Anthropic Claude 4.x series ────────────────────────────────────────
  'claude-opus-4-8':   'anthropic',
  'claude-sonnet-4-6': 'anthropic',
  'claude-haiku-4-5':  'anthropic',

  // ── Google Gemini 2.5 series (GA) ────────────────────────────────────
  'gemini-2.5-pro':        'google',
  'gemini-2.5-flash':      'google',
  'gemini-2.5-flash-lite': 'google',

  // ── Cohere Command A series ─────────────────────────────────────────────
  'command-a-03-2025':    'cohere',
  'command-r7b-12-2024':  'cohere',

  // ── Mistral current lineup ──────────────────────────────────────────────
  'mistral-large-latest':  'mistral',
  'mistral-medium-latest': 'mistral',
  'mistral-small-latest':  'mistral',
}


/**
 * Provider instances cache
 * Key format: "{provider}:{apiKey_first_8_chars}"
 */
const providerCache = new Map<string, LLMProvider>()

/**
 * Get provider name for a model
 */
export function getProviderName(model: string): 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral' {
  const provider = MODEL_TO_PROVIDER[model]
  if (!provider) {
    throw new Error(`Unknown model: ${model}. Supported models: ${Object.keys(MODEL_TO_PROVIDER).join(', ')}`)
  }
  return provider
}

/**
 * Get provider client for a model and tenant
 * 
 * Hybrid key management with tier-based enforcement:
 * 1. Check tenant tier
 * 2. Check if tenant has their own LLM key (BYOK)
 * 3. If enterprise-independent tier: REQUIRE tenant key (no fallback)
 * 4. If other tiers: Fall back to gateway key if tenant doesn't have one
 * 
 * This enables:
 * - Easy onboarding (gateway keys for free/pro/enterprise)
 * - Enterprise compliance (tenant BYOK for all tiers)
 * - Vendor independence (enterprise-independent MUST use BYOK)
 * - Seamless switching between modes
 */
export async function getProviderForRequest(
  model: string,
  tenantId: string
): Promise<LLMProvider> {
  const providerName = getProviderName(model)

  // Get tenant tier to determine fallback behavior
  const tenantTier = await getTenantTier(tenantId)

  // Try to get tenant's own key (BYOK)
  const tenantKey = await getTenantLLMKey(tenantId, providerName)

  let apiKey: string
  let keySource: 'tenant' | 'gateway'

  if (tenantKey) {
    // Use tenant's key (BYOK)
    apiKey = tenantKey
    keySource = 'tenant'
    // request.log is not easily accessible here without changing signature, so we just skip the log or use global logger if available.
    // For now we'll just keep console.log but we should probably remove it to reduce spam.
  } else {
    // Check if tenant tier allows gateway key fallback
    if (tenantTier === 'enterprise-independent') {
      throw new Error(
        `Enterprise-independent tier requires BYOK. Please configure your own ${providerName} API key. No gateway key fallback available.`
      )
    }

    // Fall back to gateway's key (for free, pro, enterprise tiers)
    switch (providerName) {
      case 'openai':
        apiKey = env.OPENAI_API_KEY
        break
      case 'anthropic':
        apiKey = env.ANTHROPIC_API_KEY
        break
      case 'google':
        apiKey = env.GOOGLE_API_KEY || ''
        break
      case 'cohere':
        apiKey = env.COHERE_API_KEY || ''
        break
      case 'mistral':
        apiKey = env.MISTRAL_API_KEY || ''
        break
      default:
        throw new Error(`No API key configured for provider: ${providerName}`)
    }
    
    if (!apiKey) {
      throw new Error(
        `No API key available for provider: ${providerName}. Configure gateway key or use BYOK.`
      )
    }
    
    keySource = 'gateway'
  }

  // Cache key includes provider and first 8 chars of API key
  const cacheKey = `${providerName}:${apiKey.substring(0, 8)}`

  // Check cache
  let provider = providerCache.get(cacheKey)

  if (!provider) {
    // Create new provider instance
    switch (providerName) {
      case 'openai':
        provider = new OpenAIProvider({ apiKey })
        break
      case 'anthropic':
        provider = new AnthropicProvider({ apiKey })
        break
      case 'google':
        provider = new GoogleProvider({ apiKey })
        break
      case 'cohere':
        provider = new CohereProvider({ apiKey })
        break
      case 'mistral':
        provider = new MistralProvider({ apiKey })
        break
      default:
        throw new Error(`Unknown provider: ${providerName}`)
    }

    // Cache it (with basic FIFO eviction to prevent memory leak)
    if (providerCache.size >= 200) {
      providerCache.delete(providerCache.keys().next().value!)
    }
    providerCache.set(cacheKey, provider)
  }

  return provider
}

/**
 * Get all provider instances (for health checks)
 */
export function getAllProviders(): LLMProvider[] {
  return Array.from(providerCache.values())
}

/**
 * Clear provider cache (for testing)
 */
export function clearProviderCache(): void {
  providerCache.clear()
}

/**
 * List all supported models
 */
export function listSupportedModels(): string[] {
  return Object.keys(MODEL_TO_PROVIDER)
}
