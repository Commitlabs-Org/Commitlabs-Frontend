'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MarketplaceCard, type CommitmentType, type MarketplaceCardProps } from './MarketplaceCard'
import { TrustBadge, type TrustLevel } from './TrustBadge'

type FeaturedListing = {
  listingId: string
  commitmentId: string
  type: CommitmentType
  amount: number
  remainingDays: number
  maxLoss: number
  currentYield: number
  complianceScore: number
  price: number
}

type FeaturedListingsResponse = {
  listings?: FeaturedListing[]
  total?: number
  data?: {
    listings?: FeaturedListing[]
    total?: number
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, '')}%`
}

function trustLevelFor(score: number): TrustLevel {
  if (score >= 92) return 'verified'
  if (score >= 85) return 'reputable'
  return 'unverified'
}

function cardFromListing(listing: FeaturedListing): MarketplaceCardProps {
  const id = listing.commitmentId.replace(/^CMT-/, '') || listing.listingId

  return {
    id,
    type: listing.type,
    score: listing.complianceScore,
    amount: formatCurrency(listing.amount),
    duration: `${listing.remainingDays} days`,
    yield: formatPercent(listing.currentYield),
    maxLoss: formatPercent(listing.maxLoss),
    owner: listing.listingId,
    price: formatCurrency(listing.price),
    forSale: listing.price > 0,
    trustLevel: trustLevelFor(listing.complianceScore),
  }
}

function getListings(payload: FeaturedListingsResponse): FeaturedListing[] {
  return payload.data?.listings ?? payload.listings ?? []
}

export function FeaturedListingsCarousel() {
  const [items, setItems] = useState<FeaturedListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const loadFeatured = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/marketplace/featured', { signal })

      if (!response.ok) {
        throw new Error(`Featured listings request failed with ${response.status}`)
      }

      const payload = (await response.json()) as FeaturedListingsResponse
      setItems(getListings(payload))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Featured listings are temporarily unavailable.')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadFeatured(controller.signal)
    return () => controller.abort()
  }, [loadFeatured])

  const scrollByCard = useCallback((direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return

    const cardWidth = track.querySelector('article')?.clientWidth ?? 320
    track.scrollBy({ left: direction * (cardWidth + 24), behavior: 'smooth' })
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollByCard(-1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollByCard(1)
    }
  }

  if (!isLoading && !error && items.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="featured-listings-title"
      className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC33] bg-[#0FF0FC0D] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0FF0FC]">
            Curated entry point
          </div>
          <h2 id="featured-listings-title" className="text-2xl font-bold tracking-tight text-white">
            Featured listings
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            High-compliance commitments selected for quick review, with trust and loss cues visible before opening the full marketplace grid.
          </p>
        </div>

        {!isLoading && !error && items.length > 1 && (
          <div className="flex items-center gap-2" aria-label="Featured listing controls">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              className="focus-ring rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              aria-label="Show previous featured listing"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              className="focus-ring rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              aria-label="Show next featured listing"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div role="status" className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-white/60">
          Loading featured listings...
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-[#FF890466] bg-[#2b1c10]/70 p-5 text-sm text-white/80">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => loadFeatured()}
            className="focus-ring mt-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div
          ref={trackRef}
          role="list"
          tabIndex={0}
          aria-label="Featured marketplace listings"
          onKeyDown={handleKeyDown}
          className="custom-scrollbar -mx-2 flex snap-x gap-5 overflow-x-auto px-2 pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
        >
          {items.map((item) => {
            const card = cardFromListing(item)
            return (
              <div key={item.listingId} role="listitem" className="w-[300px] shrink-0 snap-start sm:w-[340px]">
                <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                  <TrustBadge level={card.trustLevel ?? 'unverified'} showTooltip={false} />
                  <span className="text-xs font-semibold text-white/55">Max loss {card.maxLoss}</span>
                </div>
                <MarketplaceCard {...card} />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}