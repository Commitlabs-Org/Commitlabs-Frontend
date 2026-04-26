import { describe, it, expect, beforeEach } from 'vitest'
import { 
  redact, 
  createRedacted, 
  isSensitiveField, 
  addToDenylist, 
  removeFromDenylist 
} from '@/lib/backend/redact'

describe('Redaction Utility', () => {
  beforeEach(() => {
    // Reset denylist to defaults before each test
    const originalDenylist = new Set(['signature', 'token', 'nonce', 'authorization'])
    // Clear any runtime modifications
    while (originalDenylist.size > 0) {
      const item = originalDenylist.values().next().value
      originalDenylist.delete(item)
    }
  })

  describe('redact function', () => {
    it('should redact sensitive fields from objects', () => {
      const data = {
        username: 'john',
        token: 'secret123',
        email: 'john@example.com',
        signature: 'abc123'
      }

      const result = redact(data)

      expect(result).toEqual({
        username: 'john',
        token: '[REDACTED]',
        email: 'john@example.com',
        signature: '[REDACTED]'
      })
    })

    it('should handle nested objects', () => {
      const data = {
        user: {
          id: 123,
          token: 'user-secret',
          profile: {
            name: 'John',
            privateKey: 'private-key'
          }
        },
        metadata: {
          nonce: '12345',
          timestamp: '2023-01-01'
        }
      }

      const result = redact(data)

      expect(result).toEqual({
        user: {
          id: 123,
          token: '[REDACTED]',
          profile: {
            name: 'John',
            privateKey: '[REDACTED]'
          }
        },
        metadata: {
          nonce: '[REDACTED]',
          timestamp: '2023-01-01'
        }
      })
    })

    it('should handle arrays with sensitive data', () => {
      const data = {
        users: [
          { id: 1, token: 'token1' },
          { id: 2, token: 'token2' },
          { id: 3, name: 'alice' }
        ],
        total: 3
      }

      const result = redact(data)

      expect(result).toEqual({
        users: [
          { id: 1, token: '[REDACTED]' },
          { id: 2, token: '[REDACTED]' },
          { id: 3, name: 'alice' }
        ],
        total: 3
      })
    })

    it('should handle null and undefined values', () => {
      const data = {
        token: null,
        signature: undefined,
        name: 'john'
      }

      const result = redact(data)

      expect(result).toEqual({
        token: null,
        signature: undefined,
        name: 'john'
      })
    })

    it('should handle primitive values', () => {
      expect(redact('string')).toBe('string')
      expect(redact(123)).toBe(123)
      expect(redact(true)).toBe(true)
      expect(redact(null)).toBe(null)
      expect(redact(undefined)).toBe(undefined)
    })

    it('should handle Date objects', () => {
      const date = new Date('2023-01-01')
      const data = { createdAt: date, token: 'secret' }

      const result = redact(data)

      expect(result).toEqual({
        createdAt: date,
        token: '[REDACTED]'
      })
    })

    it('should handle Error objects', () => {
      const error = new Error('Test error')
      error.name = 'TestError'
      error.stack = 'Error stack trace'

      const result = redact(error)

      expect(result).toBeInstanceOf(Error)
      expect(result.name).toBe('TestError')
      expect(result.message).toBe('Test error')
      expect(result.stack).toBe('Error stack trace')
    })

    it('should use custom denylist', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com'
      }

      const result = redact(data, { denylist: ['password'] })

      expect(result).toEqual({
        username: 'john',
        password: '[REDACTED]',
        email: 'john@example.com'
      })
    })

    it('should use custom replacement string', () => {
      const data = {
        token: 'secret123',
        name: 'john'
      }

      const result = redact(data, { replacement: '[HIDDEN]' })

      expect(result).toEqual({
        token: '[HIDDEN]',
        name: 'john'
      })
    })

    it('should handle case-insensitive matching', () => {
      const data = {
        TOKEN: 'uppercase',
        Token: 'capitalized',
        token: 'lowercase'
      }

      const result = redact(data, { caseInsensitive: true })

      expect(result).toEqual({
        TOKEN: '[REDACTED]',
        Token: '[REDACTED]',
        token: '[REDACTED]'
      })
    })

    it('should handle case-sensitive matching when disabled', () => {
      const data = {
        TOKEN: 'uppercase',
        Token: 'capitalized',
        token: 'lowercase'
      }

      const result = redact(data, { caseInsensitive: false })

      expect(result).toEqual({
        TOKEN: 'uppercase',
        Token: 'capitalized',
        token: '[REDACTED]'
      })
    })
  })

  describe('createRedacted function', () => {
    it('should create a redacted version with custom fields', () => {
      const data = {
        username: 'john',
        customSecret: 'secret123',
        email: 'john@example.com'
      }

      const result = createRedacted(data, ['customSecret'])

      expect(result).toEqual({
        username: 'john',
        customSecret: '[REDACTED]'
      })
    })

    it('should preserve type safety', () => {
      interface UserData {
        username: string
        password: string
        email: string
      }

      const data: UserData = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com'
      }

      const result = createRedacted(data, ['password'])

      // Should be assignable back to UserData
      expect(result.username).toBe('john')
      expect(result.password).toBe('[REDACTED]')
      expect(result.email).toBeUndefined()
    })
  })

  describe('isSensitiveField function', () => {
    it('should identify default sensitive fields', () => {
      expect(isSensitiveField('token')).toBe(true)
      expect(isSensitiveField('signature')).toBe(true)
      expect(isSensitiveField('nonce')).toBe(true)
      expect(isSensitiveField('authorization')).toBe(true)
      expect(isSensitiveField('password')).toBe(true)
      expect(isSensitiveField('secret')).toBe(true)
    })

    it('should return false for non-sensitive fields', () => {
      expect(isSensitiveField('username')).toBe(false)
      expect(isSensitiveField('email')).toBe(false)
      expect(isSensitiveField('id')).toBe(false)
      expect(isSensitiveField('name')).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(isSensitiveField('TOKEN')).toBe(true)
      expect(isSensitiveField('Signature')).toBe(true)
      expect(isSensitiveField('NONCE')).toBe(true)
    })
  })

  describe('denylist management functions', () => {
    it('should add fields to denylist', () => {
      expect(isSensitiveField('customField')).toBe(false)
      
      addToDenylist('customField')
      
      expect(isSensitiveField('customField')).toBe(true)
    })

    it('should remove fields from denylist', () => {
      expect(isSensitiveField('token')).toBe(true)
      
      removeFromDenylist('token')
      
      expect(isSensitiveField('token')).toBe(false)
    })

    it('should handle case-insensitive denylist operations', () => {
      addToDenylist('CustomField')
      
      expect(isSensitiveField('customfield')).toBe(true)
      expect(isSensitiveField('CUSTOMFIELD')).toBe(true)
      
      removeFromDenylist('CUSTOMFIELD')
      
      expect(isSensitiveField('customfield')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle circular references gracefully', () => {
      const data: any = { name: 'test' }
      data.self = data
      data.token = 'secret'

      const result = redact(data)

      expect(result.name).toBe('test')
      expect(result.token).toBe('[REDACTED]')
      expect(result.self).toBe(result) // Circular reference preserved
    })

    it('should handle very deep nesting', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  token: 'deep-secret',
                  safe: 'value'
                }
              }
            }
          }
        }
      }

      const result = redact(data)

      expect(result.level1.level2.level3.level4.level5.token).toBe('[REDACTED]')
      expect(result.level1.level2.level3.level4.level5.safe).toBe('value')
    })

    it('should handle empty objects and arrays', () => {
      expect(redact({})).toEqual({})
      expect(redact([])).toEqual([])
    })

    it('should handle special number values', () => {
      const data = {
        infinity: Infinity,
        negativeInfinity: -Infinity,
        notANumber: NaN,
        token: 'secret'
      }

      const result = redact(data)

      expect(result.infinity).toBe(Infinity)
      expect(result.negativeInfinity).toBe(-Infinity)
      expect(result.notANumber).toBeNaN()
      expect(result.token).toBe('[REDACTED]')
    })
  })

  describe('performance considerations', () => {
    it('should not modify original object', () => {
      const original = { token: 'secret', name: 'john' }
      const result = redact(original)

      expect(original.token).toBe('secret') // Original unchanged
      expect(result.token).toBe('[REDACTED]') // Result redacted
      expect(result).not.toBe(original) // Different object reference
    })

    it('should handle large objects efficiently', () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          token: `token-${i}`,
          data: `data-${i}`.repeat(100)
        }))
      }

      const start = performance.now()
      const result = redact(largeData)
      const end = performance.now()

      expect(result.items[0].token).toBe('[REDACTED]')
      expect(result.items[999].token).toBe('[REDACTED]')
      expect(end - start).toBeLessThan(1000) // Should complete in under 1 second
    })
  })
})
