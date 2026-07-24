import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: 'mock-inter-var' }),
  Roboto_Mono: () => ({ variable: 'mock-roboto-mono-var' }),
}))

describe('RootLayout metadata', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('omits google site verification when NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION is unset', async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    const { metadata } = await import('./layout')
    expect(metadata.verification?.google).toBeUndefined()
  })

  it('includes google site verification when NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION is set', async () => {
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION = 'test-verification-code'
    const { metadata } = await import('./layout')
    expect(metadata.verification?.google).toBe('test-verification-code')
  })
})
