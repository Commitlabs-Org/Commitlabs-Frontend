import { describe, it, expect } from 'vitest'
import { GET, POST, PUT, PATCH, DELETE } from './route'
import { NextRequest } from 'next/server'

function makeReq(method = 'GET') {
  return new NextRequest('http://localhost/api/health', { method })
}

describe('GET /api/health', () => {
  it('returns 200 with ok wrapper', async () => {
    const res = await GET(makeReq(), { params: {} })
    expect(res.status).toBe(200)
  })

  it('response body parses as valid JSON with success and data', async () => {
    const res = await GET(makeReq(), { params: {} })
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('healthy')
    expect(typeof body.data.timestamp).toBe('string')
    expect(body.data.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('attaches security headers', async () => {
    const res = await GET(makeReq(), { params: {} })
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})

describe('405 on unsupported methods', () => {
  const cases = [
    { method: 'POST', handler: POST },
    { method: 'PUT', handler: PUT },
    { method: 'PATCH', handler: PATCH },
    { method: 'DELETE', handler: DELETE },
  ]

  for (const { method, handler } of cases) {
    it(`${method} returns 405 with Allow: GET`, async () => {
      const res = await handler(makeReq(method), { params: {} })
      expect(res.status).toBe(405)
      expect(res.headers.get('Allow')).toBe('GET')
    })
  }
})
