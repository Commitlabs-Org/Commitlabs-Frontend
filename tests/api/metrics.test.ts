import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/metrics/route'
import { createMockRequest, parseResponse } from './helpers'

describe('GET /api/metrics', () => {
  it('should return 200', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)

    expect(response.status).toBe(200)
  })

  it('should return success envelope with data field', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.data).toHaveProperty('success', true)
    expect(result.data).toHaveProperty('data')
  })

  it('should return all required HealthMetrics fields', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    const metrics = result.data.data

    expect(metrics).toHaveProperty('status')
    expect(metrics).toHaveProperty('uptime')
    expect(metrics).toHaveProperty('timestamp')
  })

  it('should return status "up"', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.data.data.status).toBe('up')
  })

  it('should return uptime as a non-negative number', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    const { uptime } = result.data.data
    expect(typeof uptime).toBe('number')
    expect(uptime).toBeGreaterThanOrEqual(0)
  })

  it('should return a valid ISO timestamp', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    const { timestamp } = result.data.data
    expect(typeof timestamp).toBe('string')
    const parsed = new Date(timestamp)
    expect(parsed).toBeInstanceOf(Date)
    expect(parsed.toString()).not.toBe('Invalid Date')
  })

  it('should return mock_requests_total as a non-negative integer', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    const { mock_requests_total } = result.data.data
    expect(typeof mock_requests_total).toBe('number')
    expect(Number.isInteger(mock_requests_total)).toBe(true)
    expect(mock_requests_total).toBeGreaterThanOrEqual(0)
  })

  it('should return mock_errors_total as a non-negative integer', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    const { mock_errors_total } = result.data.data
    expect(typeof mock_errors_total).toBe('number')
    expect(Number.isInteger(mock_errors_total)).toBe(true)
    expect(mock_errors_total).toBeGreaterThanOrEqual(0)
  })

  it('should not expose sensitive fields in the response', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)
    const result = await parseResponse(response)

    const metrics = result.data.data
    // Ensure no internal/sensitive keys leak into the metrics payload
    expect(metrics).not.toHaveProperty('env')
    expect(metrics).not.toHaveProperty('secret')
    expect(metrics).not.toHaveProperty('password')
    expect(metrics).not.toHaveProperty('token')
    expect(metrics).not.toHaveProperty('apiKey')
  })

  it('should return Content-Type application/json', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)

    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('should not expose server implementation headers', async () => {
    const request = createMockRequest('http://localhost:3000/api/metrics')
    const response = await GET(request)

    // X-Powered-By leaks server technology and should not be present
    expect(response.headers.get('x-powered-by')).toBeNull()
  })
})
