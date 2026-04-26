import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers'

describe('GET /api/health', () => {
  it('should return a 200 status with ok status', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.data).toHaveProperty('status', 'healthy')
    expect(result.data.data).toHaveProperty('timestamp')
    expect(result.data.data).toHaveProperty('version')
  })

  it('should include x-request-id response header (generated)', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    const requestId = result.headers.get('x-request-id')
    expect(typeof requestId).toBe('string')
    expect(requestId?.length).toBeGreaterThan(0)
  })

  it('should preserve x-request-id when provided by client', async () => {
    const incomingRequestId = 'test-request-id-123'
    const request = createMockRequest('http://localhost:3000/api/health', {
      headers: {
        'x-request-id': incomingRequestId,
      },
    })

    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.headers.get('x-request-id')).toBe(incomingRequestId)
  })

  it('should return ISO timestamp in response', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    const timestamp = new Date(result.data.data.timestamp)
    expect(timestamp).toBeInstanceOf(Date)
    expect(timestamp.toString()).not.toBe('Invalid Date')
  })

  it('should return version in response', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request, createMockRouteContext())
    const result = await parseResponse(response)

    expect(result.data.data.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('should attach security headers', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request, createMockRouteContext())

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
  })
})
