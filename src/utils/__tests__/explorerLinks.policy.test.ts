// @vitest-environment happy-dom

/**
 * External-link security policy coverage for the explorer link helpers.
 *
 * Complements explorerLinks.test.ts (functional behaviour) by asserting the
 * security invariants documented in docs/security/EXTERNAL_LINKS.md:
 *   1. Built URLs can only ever point at the allow-listed explorer host.
 *   2. Untrusted identifiers cannot smuggle in another host, scheme, or path.
 *   3. Programmatic opens use a safe, tab-nabbing-resistant window feature set.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { buildExplorerUrl, openExplorerUrl } from '../explorerLinks'

const ALLOWED_HOST = 'stellar.expert'
const validAccount = `G${'A'.repeat(55)}`
const validTx = 'a'.repeat(64)

describe('explorerLinks — external-link policy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('only ever produces URLs on the allow-listed host', () => {
    const url = buildExplorerUrl('account', validAccount)
    expect(url).not.toBeNull()
    expect(new URL(url!).host).toBe(ALLOWED_HOST)
    expect(new URL(url!).protocol).toBe('https:')
  })

  it('rejects identifiers that try to smuggle in another host or scheme', () => {
    const malicious = [
      'https://evil.example.com',
      '//evil.example.com',
      'javascript:alert(1)',
      `${validAccount}/../../evil`,
      `${validAccount}@evil.example.com`,
      `${validAccount} extra`,
    ]
    for (const id of malicious) {
      expect(buildExplorerUrl('account', id), `should reject: ${id}`).toBeNull()
    }
  })

  it('never emits an off-host URL even for otherwise valid-looking ids', () => {
    // Any non-null result, across kinds, must stay on the allow-listed host.
    const candidates: Array<[Parameters<typeof buildExplorerUrl>[0], string]> = [
      ['account', validAccount],
      ['tx', validTx],
      ['contract', `C${'B'.repeat(55)}`],
      ['token', 'USDC'],
    ]
    for (const [kind, id] of candidates) {
      const url = buildExplorerUrl(kind, id)
      if (url !== null) {
        expect(new URL(url).host).toBe(ALLOWED_HOST)
      }
    }
  })

  it('opens external links with noopener and noreferrer to prevent tab-nabbing', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const ok = openExplorerUrl('tx', validTx)

    expect(ok).toBe(true)
    expect(openSpy).toHaveBeenCalledTimes(1)
    const [, target, features] = openSpy.mock.calls[0]
    expect(target).toBe('_blank')
    expect(features).toContain('noopener')
    expect(features).toContain('noreferrer')
  })

  it('does not attempt to open anything for a rejected identifier', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const ok = openExplorerUrl('account', 'not-a-valid-id')

    expect(ok).toBe(false)
    expect(openSpy).not.toHaveBeenCalled()
  })
})
