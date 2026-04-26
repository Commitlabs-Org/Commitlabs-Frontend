import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'
import { createMockRequest, parseResponse } from './helpers'

describe('GET /api/health', () => {
  it('should return a 200 status with health status', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.data).toHaveProperty('status', 'healthy')
    expect(result.data.data).toHaveProperty('timestamp')
    expect(result.data.data).toHaveProperty('version')
  })

  it('should return ISO timestamp in response', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request, { params: {} })
    const result = await parseResponse(response)

    const timestamp = new Date(result.data.data.timestamp)
    expect(timestamp).toBeInstanceOf(Date)
    expect(timestamp.toString()).not.toBe('Invalid Date')
  })

  it('should return version in response', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request, { params: {} })
    const result = await parseResponse(response)

    expect(result.data.data.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('should attach security headers', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request, { params: {} })

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
  })
})
