import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, OPTIONS } from '@/app/api/health/route'
import { createMockRequest, parseResponse } from './helpers'

const ORIGINAL_PUBLIC_API_ORIGINS = process.env.COMMITLABS_PUBLIC_API_ORIGINS

afterEach(() => {
  process.env.COMMITLABS_PUBLIC_API_ORIGINS = ORIGINAL_PUBLIC_API_ORIGINS
})

beforeEach(() => {
  process.env.COMMITLABS_PUBLIC_API_ORIGINS = ORIGINAL_PUBLIC_API_ORIGINS
})

describe('GET /api/health', () => {
  it('should return a 200 status with health status', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data).toHaveProperty('status', 'healthy')
    expect(result.data).toHaveProperty('timestamp')
    expect(result.data).toHaveProperty('version')
  })

  it('should return ISO timestamp in response', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const result = await parseResponse(response)

    // Verify timestamp is valid ISO string
    const timestamp = new Date(result.data.timestamp)
    expect(timestamp).toBeInstanceOf(Date)
    expect(timestamp.toString()).not.toBe('Invalid Date')
  })

  it('should return version in response', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.data.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('should include public CORS headers on GET responses', async () => {
    process.env.COMMITLABS_PUBLIC_API_ORIGINS = '*'

    const request = createMockRequest('http://localhost:3000/api/health', {
      headers: {
        Origin: 'https://external.example',
      },
    })

    const response = await GET(request)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
    expect(response.headers.get('Vary')).toContain('Origin')
  })

  it('should answer health preflight requests', async () => {
    process.env.COMMITLABS_PUBLIC_API_ORIGINS = '*'

    const request = new NextRequest('http://localhost:3000/api/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://external.example',
        'Access-Control-Request-Method': 'GET',
      },
    })

    const response = await OPTIONS(request)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
  })

  it('should reject disallowed origins when public routes are allowlisted', async () => {
    process.env.COMMITLABS_PUBLIC_API_ORIGINS = 'https://status.commitlabs.test'

    const request = createMockRequest('http://localhost:3000/api/health', {
      headers: {
        Origin: 'https://evil.example',
      },
    })

    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(403)
    expect(result.data.success).toBe(false)
    expect(result.data.error.code).toBe('FORBIDDEN')
  })
})
