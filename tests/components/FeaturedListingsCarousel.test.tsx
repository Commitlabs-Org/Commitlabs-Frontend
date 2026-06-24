// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeaturedListingsCarousel } from '../../src/components/FeaturedListingsCarousel'

vi.mock('../../src/components/MarketplaceCard', () => ({
  MarketplaceCard: ({ id, price, trustLevel }: { id: string; price: string; trustLevel: string }) => (
    <article aria-label={`Commitment ${id}`} data-price={price} data-trust={trustLevel} />
  ),
}))

const featuredResponse = {
  success: true,
  data: {
    listings: [
      {
        listingId: 'LST-001',
        commitmentId: 'CMT-001',
        type: 'Safe',
        amount: 50000,
        remainingDays: 25,
        maxLoss: 2,
        currentYield: 5.2,
        complianceScore: 95,
        price: 52000,
      },
      {
        listingId: 'LST-002',
        commitmentId: 'CMT-002',
        type: 'Balanced',
        amount: 100000,
        remainingDays: 45,
        maxLoss: 8,
        currentYield: 12.5,
        complianceScore: 88,
        price: 105000,
      },
    ],
    total: 2,
  },
}

function mockFetch(response: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: vi.fn().mockResolvedValue(response),
    }),
  )
}

describe('FeaturedListingsCarousel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches featured listings and renders cards with trust cues', async () => {
    mockFetch(featuredResponse)

    render(<FeaturedListingsCarousel />)

    expect(screen.getByRole('status')).toHaveTextContent(/loading featured/i)
    const region = await screen.findByRole('region', { name: /featured listings/i })
    const list = within(region).getByRole('list', { name: /featured marketplace listings/i })

    expect(fetch).toHaveBeenCalledWith('/api/marketplace/featured', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('article', { name: /commitment 001/i })).toHaveAttribute('data-price', '$52,000')
    expect(screen.getByText(/max loss 2%/i)).toBeInTheDocument()
  })

  it('supports next, previous, and keyboard scrolling controls', async () => {
    mockFetch(featuredResponse)
    const scrollBy = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', { configurable: true, value: scrollBy })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 300 })

    render(<FeaturedListingsCarousel />)

    const list = await screen.findByRole('list', { name: /featured marketplace listings/i })
    fireEvent.click(screen.getByRole('button', { name: /show next/i }))
    fireEvent.click(screen.getByRole('button', { name: /show previous/i }))
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    fireEvent.keyDown(list, { key: 'ArrowLeft' })

    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 324, behavior: 'smooth' }))
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: -324, behavior: 'smooth' }))
  })

  it('hides when the endpoint returns no featured listings', async () => {
    mockFetch({ success: true, data: { listings: [], total: 0 } })

    render(<FeaturedListingsCarousel />)

    await waitFor(() => expect(screen.queryByRole('region', { name: /featured listings/i })).not.toBeInTheDocument())
  })

  it('shows an error state and retries the request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue(featuredResponse) })
    vi.stubGlobal('fetch', fetchMock)

    render(<FeaturedListingsCarousel />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/temporarily unavailable/i)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByRole('article', { name: /commitment 001/i })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})