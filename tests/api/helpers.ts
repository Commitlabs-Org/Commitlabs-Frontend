import { NextRequest } from 'next/server'

/**
 * Test helper to create mock NextRequest objects for API route testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
  } = {}
): NextRequest {
  const {
    method = 'GET',
    body = null,
    headers = {},
  } = options

  const requestInit: {
    method: string
    headers: Headers
    body?: string
  } = {
    method,
    headers: new Headers({
      'Content-Type': 'application/json',
      ...headers,
    }),
  }

  if (body) {
    requestInit.body = JSON.stringify(body)
  }

  return new NextRequest(url, requestInit)
}

export function createMockRouteContext(params: Record<string, string> = {}) {
  return { params }
}

/**
 * Test helper to parse NextResponse for assertions
 */
export async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    return {
      status: response.status,
      data: await response.json(),
      headers: response.headers,
    }
  }

  return {
    status: response.status,
    data: await response.text(),
    headers: response.headers,
  }
}
