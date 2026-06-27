import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('fonts self-hosting', () => {
  it('does not load fonts via remote googleapis CSS @import', () => {
    const globalsCssPath = path.resolve(process.cwd(), 'src/app/globals.css')
    const globalsCss = fs.readFileSync(globalsCssPath, 'utf8')

    expect(globalsCss).not.toContain('fonts.googleapis.com')

    // extra guard in case other google font import patterns are used
    expect(globalsCss).not.toMatch(/@import\s+url\(["']https:\/\/fonts\.googleapis\.com/i)
  })
})

