/**
 * PII Masking Patterns
 * 
 * Regex patterns for detecting and masking personally identifiable information
 * before storing request/response data in logs or cache.
 * 
 * These patterns are applied to message content ONLY for storage purposes.
 * The actual LLM provider receives the original unmasked content.
 */

export interface PIIPattern {
  name: string
  pattern: RegExp
  replacement: string
  description: string
}

export const PII_PATTERNS: PIIPattern[] = [
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL]',
    description: 'Email addresses',
  },
  {
    name: 'phone',
    pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
    replacement: '[PHONE]',
    description: 'Phone numbers (various formats)',
  },
  {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN]',
    description: 'US Social Security Numbers',
  },
  {
    name: 'credit_card',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[CARD]',
    description: 'Credit card numbers',
  },
  {
    name: 'ip_address',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[IP]',
    description: 'IPv4 addresses',
  },
  {
    name: 'api_key',
    pattern: /\b(?:sk-proj-[a-zA-Z0-9]{48,}|sk-[a-zA-Z0-9]{48,}|sk-ant-[a-zA-Z0-9-]{20,}|AIza[a-zA-Z0-9_-]{35})\b/g,
    replacement: '[API_KEY]',
    description: 'API keys (OpenAI, Anthropic, Google)',
  },
]

/**
 * Mask PII in a string using all configured patterns
 */
export function maskPII(text: string): string {
  let masked = text

  for (const pattern of PII_PATTERNS) {
    masked = masked.replace(pattern.pattern, pattern.replacement)
  }

  return masked
}

/**
 * Mask PII in chat messages
 */
export function maskMessages(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    ...msg,
    content: maskPII(msg.content),
  }))
}

/**
 * Check if text contains any PII
 */
export function containsPII(text: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.pattern.test(text))
}

/**
 * Get list of PII types detected in text
 */
export function detectPII(text: string): string[] {
  const detected: string[] = []

  for (const pattern of PII_PATTERNS) {
    if (pattern.pattern.test(text)) {
      detected.push(pattern.name)
    }
  }

  return detected
}
