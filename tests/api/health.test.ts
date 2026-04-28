import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'
import { createMockRequest, parseResponse } from './helpers'

describe('GET /api/health', () => {
  it('should return 200 with status ok', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data).toHaveProperty('status', 'ok')
    expect(result.data).toHaveProperty('timestamp')
  })

  it('should return a valid ISO timestamp', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const result = await parseResponse(response)

    const timestamp = new Date(result.data.timestamp)
    expect(timestamp.toString()).not.toBe('Invalid Date')
  })

  it('should include security headers', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)

    expect(response.headers.get('x-content-type-options')).toBeTruthy()
  })
})
