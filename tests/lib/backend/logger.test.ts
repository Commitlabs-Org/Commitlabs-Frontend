import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logInfo, logWarn, logError, logDebug, logCommitmentCreated, logCommitmentSettled, logEarlyExit } from '@/lib/backend/logger'

describe('Logger with Redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console methods to capture output
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  describe('logInfo', () => {
    it('should redact sensitive information from context', () => {
      const context = {
        userId: 123,
        token: 'secret-token',
        signature: 'abc123'
      }

      logInfo(undefined, 'Test message', context)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"token":"[REDACTED]"')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"signature":"[REDACTED]"')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"userId":123')
      )
    })

    it('should handle request with ID', () => {
      const mockRequest = {
        headers: new Map([['x-request-id', 'test-123']])
      } as any

      logInfo(mockRequest, 'Test message', { data: 'value' })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"requestId":"test-123"')
      )
    })
  })

  describe('logWarn', () => {
    it('should redact sensitive information from warnings', () => {
      const context = {
        warning: 'test warning',
        authorization: 'Bearer token123'
      }

      logWarn(undefined, 'Warning message', context)

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('"authorization":"[REDACTED]"')
      )
    })
  })

  describe('logError', () => {
    it('should redact sensitive information from error context', () => {
      const context = {
        error: 'test error',
        apiKey: 'secret-key'
      }
      const error = new Error('Test error')

      logError(undefined, 'Error message', error, context)

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('"apiKey":"[REDACTED]"')
      )
    })

    it('should redact sensitive information from error objects', () => {
      const error = new Error('Test error')
      ;(error as any).token = 'secret-token'

      logError(undefined, 'Error message', error)

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('"token":"[REDACTED]"')
      )
    })
  })

  describe('logDebug', () => {
    it('should only log in development environment', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      logDebug(undefined, 'Debug message', { data: 'value' })

      expect(console.debug).toHaveBeenCalled()

      process.env.NODE_ENV = originalEnv
    })

    it('should not log in production environment', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      logDebug(undefined, 'Debug message', { data: 'value' })

      expect(console.debug).not.toHaveBeenCalled()

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Analytics functions', () => {
    it('should redact sensitive information from commitment created events', () => {
      const payload = {
        commitmentId: '123',
        token: 'secret-token',
        signature: 'abc123'
      }

      logCommitmentCreated(payload)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"token":"[REDACTED]"')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"signature":"[REDACTED]"')
      )
    })

    it('should redact sensitive information from commitment settled events', () => {
      const payload = {
        commitmentId: '123',
        txHash: 'abc123',
        privateKey: 'secret-key'
      }

      logCommitmentSettled(payload)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"privateKey":"[REDACTED]"')
      )
    })

    it('should redact sensitive information from early exit events', () => {
      const payload = {
        commitmentId: '123',
        reason: 'user requested',
        nonce: 'secret-nonce'
      }

      logEarlyExit(payload)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('"nonce":"[REDACTED]"')
      )
    })
  })

  describe('Integration with redaction', () => {
    it('should handle complex nested structures with sensitive data', () => {
      const complexContext = {
        user: {
          id: 123,
          profile: {
            name: 'John Doe',
            credentials: {
              token: 'user-token',
              secret: 'user-secret'
            }
          }
        },
        transaction: {
          id: 'tx123',
          signature: 'tx-signature',
          metadata: {
            nonce: 'tx-nonce',
            amount: 1000
          }
        }
      }

      logInfo(undefined, 'Complex operation', complexContext)

      const loggedData = JSON.parse((console.log as any).mock.calls[0][0])
      
      expect(loggedData.context.user.profile.credentials.token).toBe('[REDACTED]')
      expect(loggedData.context.user.profile.credentials.secret).toBe('[REDACTED]')
      expect(loggedData.context.transaction.signature).toBe('[REDACTED]')
      expect(loggedData.context.transaction.metadata.nonce).toBe('[REDACTED]')
      expect(loggedData.context.user.profile.name).toBe('John Doe')
      expect(loggedData.context.transaction.metadata.amount).toBe(1000)
    })

    it('should handle arrays with sensitive data', () => {
      const arrayContext = {
        operations: [
          { type: 'create', token: 'token1' },
          { type: 'update', signature: 'sig1' },
          { type: 'delete', nonce: 'nonce1' }
        ]
      }

      logInfo(undefined, 'Batch operations', arrayContext)

      const loggedData = JSON.parse((console.log as any).mock.calls[0][0])
      
      expect(loggedData.context.operations[0].token).toBe('[REDACTED]')
      expect(loggedData.context.operations[1].signature).toBe('[REDACTED]')
      expect(loggedData.context.operations[2].nonce).toBe('[REDACTED]')
      expect(loggedData.context.operations[0].type).toBe('create')
    })
  })
})
