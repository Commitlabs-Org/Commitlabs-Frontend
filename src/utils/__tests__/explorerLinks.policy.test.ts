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
import { buildExplorerUrl, openExplorerUrl, safeExternalUrl, KNOWN_EXPLORER_HOSTS } from '../explorerLinks'

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

describe('safeExternalUrl — external-link policy', () => {
  it('rejects javascript: and data: schemes to prevent XSS', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('javascript:document.cookie')).toBeNull()
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeExternalUrl('data:application/json,{"test":1}')).toBeNull()
  })

  it('rejects other dangerous schemes', () => {
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull()
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull()
    expect(safeExternalUrl('ftp://example.com')).toBeNull()
    expect(safeExternalUrl('mailto:test@example.com')).toBeNull()
  })

  it('enforces host allowlist when provided to prevent open redirects', () => {
    const allowedHosts = new Set(['stellar.expert'])
    
    expect(safeExternalUrl('https://stellar.expert/tx/abc', allowedHosts)).toBe('https://stellar.expert/tx/abc')
    expect(safeExternalUrl('https://evil.com', allowedHosts)).toBeNull()
    expect(safeExternalUrl('https://stellar.expert.evil.com', allowedHosts)).toBeNull()
    expect(safeExternalUrl('//evil.com', allowedHosts)).toBeNull()
  })

  it('prevents host smuggling via @ syntax', () => {
    expect(safeExternalUrl('https://example.com@evil.com')).toBeNull()
    expect(safeExternalUrl('https://example.com:80@evil.com')).toBeNull()
    expect(safeExternalUrl('http://user@example.com@evil.com')).toBeNull()
  })

  it('only allows http and https protocols', () => {
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com')
    expect(safeExternalUrl('https://example.com')).toBe('https://example.com')
    expect(safeExternalUrl('HTTP://example.com')).toBe('http://example.com')
    expect(safeExternalUrl('HTTPS://example.com')).toBe('https://example.com')
  })

  it('rejects null, undefined, and empty inputs', () => {
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
  })

  it('rejects malformed URLs that could cause parsing errors', () => {
    expect(safeExternalUrl('not-a-url')).toBeNull()
    expect(safeExternalUrl('http://')).toBeNull()
    expect(safeExternalUrl('://example.com')).toBeNull()
    expect(safeExternalUrl('http:///')).toBeNull()
  })

  it('KNOWN_EXPLORER_HOSTS allowlist prevents off-host links', () => {
    expect(safeExternalUrl('https://stellar.expert/tx/abc', KNOWN_EXPLORER_HOSTS)).toBe('https://stellar.expert/tx/abc')
    expect(safeExternalUrl('https://steexp.com/account/xyz', KNOWN_EXPLORER_HOSTS)).toBe('https://steexp.com/account/xyz')
    expect(safeExternalUrl('https://lumenscope.io/tx/123', KNOWN_EXPLORER_HOSTS)).toBe('https://lumenscope.io/tx/123')
    expect(safeExternalUrl('https://evil.com', KNOWN_EXPLORER_HOSTS)).toBeNull()
    expect(safeExternalUrl('https://phishing-site.com', KNOWN_EXPLORER_HOSTS)).toBeNull()
  })
})
