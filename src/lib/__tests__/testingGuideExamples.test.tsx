// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react'
import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress, isConnected } from '@stellar/freighter-api'

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(async () => ({ isConnected: true })),
  getAddress: vi.fn(async () => ({ address: 'GCOMMITLABSEXAMPLEADDRESS' })),
}))

const originalFetch = globalThis.fetch

async function readHealthStatus() {
  const response = await fetch('/api/health')
  const body = await response.json()
  return body.status as string
}

function ExampleCounter() {
  const [count, setCount] = useState(0)

  return (
    <section aria-label="Example counter">
      <output aria-label="count">{count}</output>
      <button type="button" onClick={() => setCount((current) => current + 1)}>
        Increment
      </button>
    </section>
  )
}

describe('testing guide examples', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T12:00:00Z'))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('mocks fetch with a JSON response', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch

    await expect(readHealthStatus()).resolves.toBe('ok')
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/health')
  })

  it('mocks Freighter wallet calls', async () => {
    await expect(isConnected()).resolves.toEqual({ isConnected: true })
    await expect(getAddress()).resolves.toEqual({ address: 'GCOMMITLABSEXAMPLEADDRESS' })
  })

  it('uses fake timers for deterministic time assertions', () => {
    expect(new Date().toISOString()).toBe('2026-06-23T12:00:00.000Z')
  })

  it('uses role and label queries for component behavior', () => {
    render(<ExampleCounter />)

    fireEvent.click(screen.getByRole('button', { name: 'Increment' }))

    expect(screen.getByRole('region', { name: 'Example counter' })).toBeInTheDocument()
    expect(screen.getByLabelText('count')).toHaveTextContent('1')
  })
})
