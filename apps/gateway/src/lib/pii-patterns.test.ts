/**
 * PII Patterns Tests
 * 
 * Tests for PII detection and masking functionality
 */

import { describe, it, expect } from 'vitest'
import {
  maskPII,
  maskMessages,
  containsPII,
  detectPII,
  PII_PATTERNS,
} from './pii-patterns'

describe('PII Patterns', () => {
  describe('Email Detection', () => {
    it('should mask email addresses', () => {
      const text = 'Contact me at john@example.com for details'
      const masked = maskPII(text)
      expect(masked).toBe('Contact me at [EMAIL] for details')
    })

    it('should mask multiple email addresses', () => {
      const text = 'Email john@example.com or jane@test.org'
      const masked = maskPII(text)
      expect(masked).toBe('Email [EMAIL] or [EMAIL]')
    })

    it('should mask emails with subdomains', () => {
      const text = 'Send to admin@mail.company.com'
      const masked = maskPII(text)
      expect(masked).toBe('Send to [EMAIL]')
    })
  })

  describe('Phone Number Detection', () => {
    it('should mask US phone numbers with dashes', () => {
      const text = 'Call me at 555-123-4567'
      const masked = maskPII(text)
      expect(masked).toBe('Call me at [PHONE]')
    })

    it('should mask phone numbers with parentheses', () => {
      const text = 'Phone: (555) 123-4567'
      const masked = maskPII(text)
      expect(masked).toBe('Phone: [PHONE]')
    })

    it('should mask international phone numbers', () => {
      const text = 'Call +1 555 123 4567'
      const masked = maskPII(text)
      expect(masked).toBe('Call [PHONE]')
    })

    it('should mask phone numbers with dots', () => {
      const text = 'Contact: 555.123.4567'
      const masked = maskPII(text)
      expect(masked).toBe('Contact: [PHONE]')
    })
  })

  describe('SSN Detection', () => {
    it('should mask Social Security Numbers', () => {
      const text = 'SSN: 123-45-6789'
      const masked = maskPII(text)
      expect(masked).toBe('SSN: [SSN]')
    })

    it('should mask multiple SSNs', () => {
      const text = 'SSN1: 123-45-6789, SSN2: 987-65-4321'
      const masked = maskPII(text)
      expect(masked).toBe('SSN1: [SSN], SSN2: [SSN]')
    })
  })

  describe('Credit Card Detection', () => {
    it('should mask credit card numbers with spaces', () => {
      const text = 'Card: 4532 1234 5678 9010'
      const masked = maskPII(text)
      expect(masked).toBe('Card: [CARD]')
    })

    it('should mask credit card numbers with dashes', () => {
      const text = 'Card: 4532-1234-5678-9010'
      const masked = maskPII(text)
      expect(masked).toBe('Card: [CARD]')
    })

    it('should mask credit card numbers without separators', () => {
      const text = 'Card: 4532123456789010'
      const masked = maskPII(text)
      expect(masked).toBe('Card: [CARD]')
    })
  })

  describe('IP Address Detection', () => {
    it('should mask IPv4 addresses', () => {
      const text = 'Server IP: 192.168.1.1'
      const masked = maskPII(text)
      expect(masked).toBe('Server IP: [IP]')
    })

    it('should mask multiple IP addresses', () => {
      const text = 'From 10.0.0.1 to 192.168.1.100'
      const masked = maskPII(text)
      expect(masked).toBe('From [IP] to [IP]')
    })

    it('should mask public IP addresses', () => {
      const text = 'Public IP: 8.8.8.8'
      const masked = maskPII(text)
      expect(masked).toBe('Public IP: [IP]')
    })
  })

  describe('API Key Detection', () => {
    it('should mask OpenAI API keys', () => {
      const text = 'Key: sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234'
      const masked = maskPII(text)
      expect(masked).toBe('Key: [API_KEY]')
    })

    it('should mask Anthropic API keys', () => {
      const text = 'Key: sk-ant-api03-abc123def456ghi789jkl012mno345pqr678'
      const masked = maskPII(text)
      expect(masked).toBe('Key: [API_KEY]')
    })

    it('should mask Google API keys', () => {
      const text = 'Key: AIzaSyAbc123Def456Ghi789Jkl012Mno345Pqr'
      const masked = maskPII(text)
      expect(masked).toBe('Key: [API_KEY]')
    })
  })

  describe('Multiple PII Types', () => {
    it('should mask multiple types of PII in one string', () => {
      const text = 'Contact john@example.com at 555-123-4567 or IP 192.168.1.1'
      const masked = maskPII(text)
      expect(masked).toBe('Contact [EMAIL] at [PHONE] or IP [IP]')
    })

    it('should mask all PII types in a complex string', () => {
      const text = 'User: john@example.com, Phone: (555) 123-4567, SSN: 123-45-6789, Card: 4532-1234-5678-9010, IP: 10.0.0.1'
      const masked = maskPII(text)
      expect(masked).toBe('User: [EMAIL], Phone: [PHONE], SSN: [SSN], Card: [CARD], IP: [IP]')
    })
  })

  describe('maskMessages', () => {
    it('should mask PII in chat messages', () => {
      const messages = [
        { role: 'user', content: 'My email is john@example.com' },
        { role: 'assistant', content: 'I received your email' },
        { role: 'user', content: 'Call me at 555-123-4567' },
      ]

      const masked = maskMessages(messages)

      expect(masked).toEqual([
        { role: 'user', content: 'My email is [EMAIL]' },
        { role: 'assistant', content: 'I received your email' },
        { role: 'user', content: 'Call me at [PHONE]' },
      ])
    })

    it('should preserve messages without PII', () => {
      const messages = [
        { role: 'user', content: 'What is the weather today?' },
        { role: 'assistant', content: 'The weather is sunny' },
      ]

      const masked = maskMessages(messages)

      expect(masked).toEqual(messages)
    })

    it('should handle empty messages array', () => {
      const messages: Array<{ role: string; content: string }> = []
      const masked = maskMessages(messages)
      expect(masked).toEqual([])
    })
  })

  describe('containsPII', () => {
    it('should return true when text contains email', () => {
      expect(containsPII('Contact john@example.com')).toBe(true)
    })

    it('should return true when text contains phone', () => {
      expect(containsPII('Call 555-123-4567')).toBe(true)
    })

    it('should return true when text contains SSN', () => {
      expect(containsPII('SSN: 123-45-6789')).toBe(true)
    })

    it('should return false when text contains no PII', () => {
      expect(containsPII('This is a normal message')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(containsPII('')).toBe(false)
    })
  })

  describe('detectPII', () => {
    it('should detect email type', () => {
      const detected = detectPII('Email: john@example.com')
      expect(detected).toContain('email')
    })

    it('should detect phone type', () => {
      const detected = detectPII('Phone: 555-123-4567')
      expect(detected).toContain('phone')
    })

    it('should detect multiple PII types', () => {
      const detected = detectPII('Email john@example.com, Phone 555-123-4567')
      expect(detected).toContain('email')
      expect(detected).toContain('phone')
    })

    it('should return empty array for no PII', () => {
      const detected = detectPII('Normal text')
      expect(detected).toEqual([])
    })

    it('should detect all PII types', () => {
      const text = 'john@example.com 555-123-4567 123-45-6789 4532-1234-5678-9010 192.168.1.1 sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz'
      const detected = detectPII(text)
      expect(detected).toContain('email')
      expect(detected).toContain('phone')
      expect(detected).toContain('ssn')
      expect(detected).toContain('credit_card')
      expect(detected).toContain('ip_address')
      expect(detected).toContain('api_key')
    })
  })

  describe('PII_PATTERNS', () => {
    it('should export all pattern definitions', () => {
      expect(PII_PATTERNS).toHaveLength(6)
      expect(PII_PATTERNS.map(p => p.name)).toEqual([
        'email',
        'phone',
        'ssn',
        'credit_card',
        'ip_address',
        'api_key',
      ])
    })

    it('should have valid regex patterns', () => {
      PII_PATTERNS.forEach(pattern => {
        expect(pattern.pattern).toBeInstanceOf(RegExp)
        expect(pattern.pattern.global).toBe(true) // All patterns should be global
      })
    })

    it('should have replacement strings', () => {
      PII_PATTERNS.forEach(pattern => {
        expect(pattern.replacement).toBeTruthy()
        expect(pattern.replacement).toMatch(/^\[.+\]$/) // Should be in [BRACKETS]
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      expect(maskPII('')).toBe('')
    })

    it('should handle string with only PII', () => {
      expect(maskPII('john@example.com')).toBe('[EMAIL]')
    })

    it('should handle repeated PII', () => {
      const text = 'john@example.com john@example.com'
      const masked = maskPII(text)
      expect(masked).toBe('[EMAIL] [EMAIL]')
    })

    it('should not mask partial matches', () => {
      // "123" is not a valid SSN
      const text = 'Code: 123'
      const masked = maskPII(text)
      expect(masked).toBe('Code: 123')
    })

    it('should preserve whitespace and formatting', () => {
      const text = '  Email:  john@example.com  \n  Phone:  555-123-4567  '
      const masked = maskPII(text)
      expect(masked).toBe('  Email:  [EMAIL]  \n  Phone:  [PHONE]  ')
    })
  })
})
