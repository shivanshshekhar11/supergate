import { env } from '../config'
import { getTenantLLMKey, getTenantTier } from '../lib/tenant-keys'
import { LLMProvider } from './types'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'
import { GoogleProvider } from './google'
import { CohereProvider } from './cohere'
import { MistralProvider } from './mistral'

/**
 * Model to provider mapping
 * Maps model names to their respective providers
 */
const MODEL_TO_PROVIDER: Record<string, 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral'> = {
  // OpenAI models
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-4o-2024-11-20': 'openai',
  'gpt-4o-2024-08-06': 'openai',
  'gpt-4o-2024-05-13': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-4': 'openai',
  'gpt-3.5-turbo': 'openai',
  'gpt-3.5-turbo-0125': 'openai',

  // Anthropic models
  'claude-3-5-sonnet-20241022': 'anthropic',
  'claude-3-5-sonnet-20240620': 'anthropic',
  'claude-3-5-haiku-20241022': 'anthropic',
  'claude-3-opus-20240229': 'anthropic',
  'claude-3-sonnet-20240229': 'anthropic',
  'claude-3-haiku-20240307': 'anthropic',

  // Google Gemini models
  'gemini-2.0-flash-exp': 'google',
  'gemini-1.5-pro': 'google',
  'gemini-1.5-pro-001': 'google',
  'gemini-1.5-pro-002': 'google',
  'gemini-1.5-flash': 'google',
  'gemini-1.5-flash-001': 'google',
  'gemini-1.5-flash-002': 'google',
  'gemini-1.5-flash-8b': 'google',
  'gemini-1.0-pro': 'google',
  'gemini-1.0-pro-001': 'google',

  // Cohere models
  'command-r-plus': 'cohere',
  'command-r-plus-08-2024': 'cohere',
  'command-r': 'cohere',
  'command-r-08-2024': 'cohere',
  'command': 'cohere',
  'command-light': 'cohere',
  'command-nightly': 'cohere',
  'command-light-nightly': 'cohere',

  // Mistral models
  'mistral-large-latest': 'mistral',
  'mistral-large-2411': 'mistral',
  'mistral-large-2407': 'mistral',
  'mistral-medium-latest': 'mistral',
  'mistral-medium-2312': 'mistral',
  'mistral-small-latest': 'mistral',
  'mistral-small-2409': 'mistral',
  'mistral-small-2402': 'mistral',
  'pixtral-12b-2409': 'mistral',
  'pixtral-large-latest': 'mistral',
  'open-mistral-7b': 'mistral',
  'open-mixtral-8x7b': 'mistral',
  'open-mixtral-8x22b': 'mistral',
  'open-mistral-nemo': 'mistral',
  'open-mistral-nemo-2407': 'mistral',
  'codestral-latest': 'mistral',
  'codestral-2405': 'mistral',
  'ministral-8b-latest': 'mistral',
  'ministral-3b-latest': 'mistral',
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
    console.log(`[ProviderRouter] Using tenant BYOK for ${providerName} (tenant: ${tenantId}, tier: ${tenantTier})`)
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
    console.log(`[ProviderRouter] Using gateway key for ${providerName} (tenant: ${tenantId}, tier: ${tenantTier})`)
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

    // Cache it
    providerCache.set(cacheKey, provider)
    console.log(`[ProviderRouter] Created new ${providerName} provider instance (${keySource} key)`)
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
