import { NextRequest, NextResponse } from 'next/server'
import { afterEach, describe, expect, it } from 'vitest'
import { ForbiddenError } from './errors'
import { withApiHandler } from './withApiHandler'

const ORIGINAL_FIRST_PARTY_ORIGINS = process.env.COMMITLABS_FIRST_PARTY_ORIGINS

afterEach(() => {
  process.env.COMMITLABS_FIRST_PARTY_ORIGINS = ORIGINAL_FIRST_PARTY_ORIGINS
})

describe('withApiHandler', () => {
  it('returns successful responses without CORS when no policy is provided', async () => {
    const handler = withApiHandler(async (_req, _ctx, correlationId) =>
      NextResponse.json({ success: true, correlationId }, { status: 200 })
    )

    const response = await handler(
      new NextRequest('http://localhost:3000/api/example', { method: 'GET' }),
      { params: {} }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(response.headers.get('x-correlation-id')).toBeTruthy()
  })

  it('converts ApiError instances into JSON responses and preserves CORS headers', async () => {
    process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test'

    const handler = withApiHandler(
      async () => {
        throw new ForbiddenError('Blocked by policy')
      },
      {
        cors: {
          GET: { access: 'first-party' },
        },
      }
    )

    const response = await handler(
      new NextRequest('http://localhost:3000/api/example', {
        method: 'GET',
        headers: {
          Origin: 'https://app.commitlabs.test',
        },
      }),
      { params: {} }
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('FORBIDDEN')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.commitlabs.test')
  })
})
