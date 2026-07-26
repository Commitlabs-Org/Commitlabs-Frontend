import { describe, it, expect } from 'vitest'
import { generateMetadata as commitmentGenerateMetadata } from '@/app/commitments/[id]/layout'
import { metadata as marketplaceMetadata } from '@/app/marketplace/layout'

describe('commitment detail generateMetadata', () => {
  it('returns correct title and description for a known id', async () => {
    const result = await commitmentGenerateMetadata({ params: { id: '42' } })
    expect(result.title).toBe('Commitment #42 — CommitLabs')
    expect(result.description).toContain('#42')
  })

  it('returns correct openGraph fields', async () => {
    const result = await commitmentGenerateMetadata({ params: { id: '7' } })
    const og = result.openGraph as Record<string, unknown>
    expect(og.title).toBe('Commitment #7 — CommitLabs')
    expect(og.url).toBe('https://commitlabs.com/commitments/7')
    expect(og.siteName).toBe('CommitLabs')
    expect(og.locale).toBe('en_US')
    expect(og.type).toBe('website')
    const images = og.images as { url: string; width: number; height: number; alt: string }[]
    expect(images[0].url).toBe('/og-image.jpg')
    expect(images[0].width).toBe(1200)
    expect(images[0].height).toBe(630)
  })

  it('returns correct twitter card fields', async () => {
    const result = await commitmentGenerateMetadata({ params: { id: '7' } })
    const tw = result.twitter as Record<string, unknown>
    expect(tw.card).toBe('summary_large_image')
    expect(tw.title).toBe('Commitment #7 — CommitLabs')
    expect((tw.images as string[])[0]).toBe('/og-image.jpg')
  })

  it('does not leak sensitive data for an unknown id', async () => {
    const result = await commitmentGenerateMetadata({ params: { id: 'unknown-xyz' } })
    const title = result.title as string
    const desc = result.description as string
    // Title should only contain the id slug, no wallet addresses or private data
    expect(title).toBe('Commitment #unknown-xyz — CommitLabs')
    expect(desc).not.toMatch(/G[A-Z0-9]{55}/) // no Stellar address
  })

  it('uses id from params in the OG url for arbitrary ids', async () => {
    const result = await commitmentGenerateMetadata({ params: { id: 'abc-123' } })
    const og = result.openGraph as Record<string, unknown>
    expect(og.url).toBe('https://commitlabs.com/commitments/abc-123')
  })
})

describe('marketplace metadata', () => {
  it('has title and description', () => {
    expect(marketplaceMetadata.title).toBe('Marketplace — CommitLabs')
    expect(typeof marketplaceMetadata.description).toBe('string')
    expect((marketplaceMetadata.description as string).length).toBeGreaterThan(0)
  })

  it('has complete openGraph fields', () => {
    const og = marketplaceMetadata.openGraph as Record<string, unknown>
    expect(og.title).toBeTruthy()
    expect(og.url).toBe('https://commitlabs.com/marketplace')
    expect(og.siteName).toBe('CommitLabs')
    expect(og.locale).toBe('en_US')
    expect(og.type).toBe('website')
    const images = og.images as { url: string }[]
    expect(images[0].url).toBe('/og-image.jpg')
  })

  it('has twitter card fields', () => {
    const tw = marketplaceMetadata.twitter as Record<string, unknown>
    expect(tw.card).toBe('summary_large_image')
    expect(tw.title).toBeTruthy()
    expect((tw.images as string[])[0]).toBe('/og-image.jpg')
  })
})
