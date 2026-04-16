import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { env } from '../config'

/**
 * Encryption service for tenant LLM API keys
 * Uses AES-256-GCM for authenticated encryption
 * 
 * Security notes:
 * - Master key derived from ENCRYPTION_MASTER_KEY env var
 * - Each encryption uses a unique IV (initialization vector)
 * - GCM mode provides both confidentiality and authenticity
 * - Keys are never logged or exposed in error messages
 */

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Derive a 256-bit key from the master key
 */
function getMasterKey(): Buffer {
  const masterKey = env.ENCRYPTION_MASTER_KEY
  
  if (!masterKey || masterKey.length < 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must be at least 32 characters')
  }
  
  // Use SHA-256 to derive a consistent 32-byte key
  return createHash('sha256').update(masterKey).digest()
}

/**
 * Encrypt a plaintext API key
 * Returns base64-encoded encrypted data and IV
 */
export function encryptApiKey(plaintext: string): { encrypted: string; iv: string } {
  try {
    const masterKey = getMasterKey()
    const iv = randomBytes(IV_LENGTH)
    
    const cipher = createCipheriv(ALGORITHM, masterKey, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    // Get authentication tag
    const authTag = cipher.getAuthTag()
    
    // Combine encrypted data + auth tag
    const combined = Buffer.concat([
      Buffer.from(encrypted, 'base64'),
      authTag,
    ])
    
    return {
      encrypted: combined.toString('base64'),
      iv: iv.toString('base64'),
    }
  } catch (error) {
    // Never expose the plaintext in error messages
    throw new Error('Failed to encrypt API key')
  }
}

/**
 * Decrypt an encrypted API key
 * Returns the plaintext API key
 */
export function decryptApiKey(encrypted: string, ivBase64: string): string {
  try {
    const masterKey = getMasterKey()
    const iv = Buffer.from(ivBase64, 'base64')
    const combined = Buffer.from(encrypted, 'base64')
    
    // Split encrypted data and auth tag
    const encryptedData = combined.subarray(0, combined.length - AUTH_TAG_LENGTH)
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
    
    const decipher = createDecipheriv(ALGORITHM, masterKey, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encryptedData, undefined, 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    // Never expose encrypted data in error messages
    throw new Error('Failed to decrypt API key - data may be corrupted or key may be wrong')
  }
}

/**
 * Mask an API key for display
 * Shows only the prefix and suffix
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 12) {
    return '***'
  }
  
  const prefix = apiKey.substring(0, 8)
  const suffix = apiKey.substring(apiKey.length - 4)
  
  return `${prefix}...${suffix}`
}

/**
 * Validate API key format before encryption
 */
export function validateApiKeyFormat(
  apiKey: string,
  provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral'
): boolean {
  if (provider === 'openai') {
    // OpenAI keys start with 'sk-' and are typically 48-51 chars
    return apiKey.startsWith('sk-') && apiKey.length >= 20
  }
  
  if (provider === 'anthropic') {
    // Anthropic keys start with 'sk-ant-' and are typically 100+ chars
    return apiKey.startsWith('sk-ant-') && apiKey.length >= 20
  }
  
  if (provider === 'google') {
    // Google API keys start with 'AIza' and are 39 chars
    return apiKey.startsWith('AIza') && apiKey.length >= 20
  }
  
  if (provider === 'cohere') {
    // Cohere keys are typically 40 chars, no specific prefix
    return apiKey.length >= 20
  }
  
  if (provider === 'mistral') {
    // Mistral keys are typically 32 chars, no specific prefix
    return apiKey.length >= 20
  }
  
  return false
}
