import { describe, it, expect } from 'vitest'

const BASE_URL = 'https://commitlabs.com'

const PUBLIC_ROUTES = ['', '/marketplace', '/transaction-error', '/network-error']

const PRIVATE_ROUTES = [
  '/create',
  '/commitments',
  '/commitments/overview',
  '/commitments/1',
  '/commitments/abc',
  '/settings',
]

function getExpectedSitemapUrls(): string[] {
  return PUBLIC_ROUTES.map((route) => `${BASE_URL}${route}`)
}

function sitemapContainsAllPublicRoutes(entries: { url: string }[]): boolean {
  const urls = entries.map((e) => e.url)
  return getExpectedSitemapUrls().every((u) => urls.includes(u))
}

function sitemapExcludesRoutes(entries: { url: string }[], routes: string[]): boolean {
  const urls = entries.map((e) => e.url)
  return routes.every((r) => !urls.includes(`${BASE_URL}${r}`))
}

function sitemapHasUniqueUrls(entries: { url: string }[]): boolean {
  const urls = entries.map((e) => e.url)
  return new Set(urls).size === urls.length
}

describe('sitemap', () => {
  describe('public route enumeration', () => {
    it('includes all expected public routes', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      expect(sitemapContainsAllPublicRoutes(entries)).toBe(true)
    })

    it('excludes wallet-gated /create', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      expect(sitemapExcludesRoutes(entries, ['/create'])).toBe(true)
    })

    it('excludes wallet-gated /commitments and sub-routes', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      expect(
        sitemapExcludesRoutes(entries, [
          '/commitments',
          '/commitments/overview',
          '/commitments/1',
        ]),
      ).toBe(true)
    })

    it('excludes wallet-gated /settings', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      expect(sitemapExcludesRoutes(entries, ['/settings'])).toBe(true)
    })

    it('excludes all private routes', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      expect(sitemapExcludesRoutes(entries, PRIVATE_ROUTES)).toBe(true)
    })

    it('has no duplicate URLs', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      expect(sitemapHasUniqueUrls(entries)).toBe(true)
    })
  })

  describe('entry structure', () => {
    it('each entry has url, lastModified, changeFrequency, and priority', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      for (const entry of entries) {
        expect(entry).toHaveProperty('url')
        expect(entry).toHaveProperty('lastModified')
        expect(entry).toHaveProperty('changeFrequency')
        expect(entry).toHaveProperty('priority')
      }
    })

    it('priorities are between 0 and 1', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      for (const entry of entries) {
        expect(entry.priority).toBeGreaterThanOrEqual(0)
        expect(entry.priority).toBeLessThanOrEqual(1)
      }
    })

    it('urls use https protocol', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      for (const entry of entries) {
        expect(entry.url).toMatch(/^https:\/\//)
      }
    })
  })

  describe('edge cases', () => {
    it('handles new public route addition (drift detection)', async () => {
      const { default: sitemap } = await import('./sitemap')
      const entries = sitemap()
      const urls = entries.map((e) => e.url)
      // If a new public route appears, this test will fail until it's
      // explicitly added to PUBLIC_ROUTES above. The test ensures every
      // sitemap entry is intentional.
      const documentedPublicUrls = getExpectedSitemapUrls()
      for (const url of urls) {
        expect(documentedPublicUrls).toContain(url)
      }
    })
  })
})
