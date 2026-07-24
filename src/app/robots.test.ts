import { describe, it, expect } from 'vitest'
import robots from './robots'

// Replicate the base URL used in the route (must stay in sync)
const BASE_URL = 'https://commitlabs.com'

describe('robots.txt generation', () => {
  it('includes a generic allow rule for all agents', () => {
    const result = robots()
    expect(result.rules).toBeDefined()
    // Expect at least one rule matching our simple allow
    const allowRule = result.rules.find((r: any) => r.userAgent === '*')
    expect(allowRule).toBeDefined()
    expect(allowRule.allow).toBe('/')
  })

  it('references the dynamic sitemap URL', () => {
    const result = robots()
    expect(result.sitemap).toBe(`${BASE_URL}/sitemap.xml`)
  })
})
