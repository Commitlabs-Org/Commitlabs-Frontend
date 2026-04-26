import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/metrics/route'
import { createMockRequest, parseResponse } from './helpers'
import { getCountersAdapter, resetCountersAdapter } from '@/lib/backend/counters/provider'

// Mock ioredis to avoid dependency issues in tests
vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      constructor() {
        this.data = new Map()
      }
      incr(key) {
        const val = this.data.get(key) || 0
        this.data.set(key, val + 1)
        return Promise.resolve(val + 1)
      }
      mget(keys) {
        const values = keys.map(key => this.data.get(key) || null)
        return Promise.resolve(values)
      }
      del(keys) {
        keys.forEach(key => this.data.delete(key))
        return Promise.resolve(keys.length)
      }
      quit() {
        return Promise.resolve()
      }
    }
  }
})

describe('GET /api/metrics', () => {
  beforeEach(() => {
    // Reset the counters adapter singleton and reset the counters
    resetCountersAdapter()
    // Ensure we are in test environment for the provider to return in-memory counters
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should return a 200 status with metrics', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.data).toHaveProperty('status', 'up')
    expect(result.data.data).toHaveProperty('uptime')
    expect(result.data.data).toHaveProperty('rate_limit_blocks', 0)
    expect(result.data.data).toHaveProperty('auth_failures', 0)
    expect(result.data.data).toHaveProperty('chain_failures', 0)
    expect(result.data.data).toHaveProperty('successful_actions', 0)
    expect(result.data.data).toHaveProperty('timestamp')
  })

  it('should increment counters when called from other services', async () => {
    // Simulate some events
    const countersAdapter = getCountersAdapter()
    countersAdapter.incrementRateLimitBlocks()
    countersAdapter.incrementAuthFailures()
    countersAdapter.incrementAuthFailures()
    countersAdapter.incrementChainFailures()
    countersAdapter.incrementSuccessfulActions()
    countersAdapter.incrementSuccessfulActions()
    countersAdapter.incrementSuccessfulActions()

    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.data.rate_limit_blocks).toBe(1)
    expect(result.data.data.auth_failures).toBe(2)
    expect(result.data.data.chain_failures).toBe(1)
    expect(result.data.data.successful_actions).toBe(3)
  })
})