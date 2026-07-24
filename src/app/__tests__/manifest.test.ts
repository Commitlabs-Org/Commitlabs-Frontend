import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import manifest from '../manifest'

describe('web app manifest', () => {
  const m = manifest()

  it('exposes required installability fields', () => {
    expect(m.name).toBeTruthy()
    expect(m.short_name).toBeTruthy()
    expect(m.description).toBeTruthy()
    expect(m.start_url).toBe('/')
    expect(m.scope).toBe('/')
    expect(m.display).toBe('standalone')
  })

  it('uses the design-token surface color for theme and background', () => {
    expect(m.theme_color).toBe('#0a0a0a')
    expect(m.background_color).toBe('#0a0a0a')
  })

  it('declares at least one icon and every icon asset exists in public/', () => {
    expect(Array.isArray(m.icons)).toBe(true)
    expect(m.icons!.length).toBeGreaterThan(0)

    for (const icon of m.icons!) {
      expect(icon.src.startsWith('/')).toBe(true)
      const filePath = join(process.cwd(), 'public', icon.src.replace(/^\//, ''))
      expect(existsSync(filePath), `missing icon asset: public${icon.src}`).toBe(true)
    }
  })

  it('declares a maskable icon for adaptive launchers', () => {
    const purposes = (m.icons ?? []).map((i) => i.purpose)
    expect(purposes).toContain('maskable')
  })
})
