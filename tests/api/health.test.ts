import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'
import { createMockRequest, parseResponse } from './helpers'

describe('GET /api/health', () => {
  it('should return a 200 status with ok status', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data).toHaveProperty('status', 'ok')
    expect(result.data).toHaveProperty('timestamp')
  })

  it('should return ISO timestamp in response', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const result = await parseResponse(response)

    const timestamp = new Date(result.data.timestamp)
    expect(timestamp).toBeInstanceOf(Date)
    expect(timestamp.toString()).not.toBe('Invalid Date')
  })
})
