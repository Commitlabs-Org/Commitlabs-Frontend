// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { buildExplorerUrl, openExplorerUrl, safeExternalUrl, KNOWN_EXPLORER_HOSTS } from '../explorerLinks'

const validTxHash = 'a'.repeat(64)
const validAccount = `G${'A'.repeat(55)}`
const validContract = `C${'B'.repeat(55)}`

describe('explorerLinks', () => {
  it('builds explorer URLs for validated Stellar identifiers', () => {
    expect(buildExplorerUrl('tx', validTxHash)).toBe(
      `https://stellar.expert/explorer/public/tx/${validTxHash}`,
    )
    expect(buildExplorerUrl('account', validAccount, 'testnet')).toBe(
      `https://stellar.expert/explorer/testnet/account/${validAccount}`,
    )
    expect(buildExplorerUrl('contract', validContract, 'testnet')).toBe(
      `https://stellar.expert/explorer/testnet/contract/${validContract}`,
    )
    expect(buildExplorerUrl('token', 'USDC:GDQOE23Y3XE45JQFOD5A')).toBe(
      'https://stellar.expert/explorer/public/asset/USDC%3AGDQOE23Y3XE45JQFOD5A',
    )
  })

  it('rejects malformed or ambiguous identifiers', () => {
    expect(buildExplorerUrl('tx', 'abc 123')).toBeNull()
    expect(buildExplorerUrl('tx', '0x1234')).toBeNull()
    expect(buildExplorerUrl('account', validContract)).toBeNull()
    expect(buildExplorerUrl('contract', validAccount)).toBeNull()
    expect(buildExplorerUrl('token', '../account/GATTACK')).toBeNull()
    expect(buildExplorerUrl('token', ' USDC')).toBeNull()
  })

  it('opens validated URLs with noopener and noreferrer', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    expect(openExplorerUrl('tx', validTxHash)).toBe(true)
    expect(openSpy).toHaveBeenCalledWith(
      `https://stellar.expert/explorer/public/tx/${validTxHash}`,
      '_blank',
      'noopener,noreferrer',
    )

    expect(openExplorerUrl('tx', 'abc 123')).toBe(false)
    expect(openSpy).toHaveBeenCalledTimes(1)
  })
})

describe('safeExternalUrl', () => {
  it('accepts valid http and https URLs', () => {
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com')
    expect(safeExternalUrl('https://example.com')).toBe('https://example.com')
    expect(safeExternalUrl('https://example.com/path')).toBe('https://example.com/path')
    expect(safeExternalUrl('https://example.com/path?query=value')).toBe('https://example.com/path?query=value')
  })

  it('rejects dangerous schemes', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull()
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull()
    expect(safeExternalUrl('ftp://example.com')).toBeNull()
  })

  it('rejects null, undefined, and empty strings', () => {
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
  })

  it('rejects malformed URLs', () => {
    expect(safeExternalUrl('not-a-url')).toBeNull()
    expect(safeExternalUrl('http://')).toBeNull()
    expect(safeExternalUrl('://example.com')).toBeNull()
  })

  it('enforces allowed hosts when provided', () => {
    const allowedHosts = new Set(['stellar.expert', 'example.com'])
    
    expect(safeExternalUrl('https://stellar.expert/tx/abc', allowedHosts)).toBe('https://stellar.expert/tx/abc')
    expect(safeExternalUrl('https://example.com/path', allowedHosts)).toBe('https://example.com/path')
    expect(safeExternalUrl('https://evil.com', allowedHosts)).toBeNull()
    expect(safeExternalUrl('https://stellar.expert.evil.com', allowedHosts)).toBeNull()
  })

  it('allows any http(s) host when allowedHosts is not provided', () => {
    expect(safeExternalUrl('https://any-host.com')).toBe('https://any-host.com')
    expect(safeExternalUrl('http://another-host.org')).toBe('http://another-host.org')
  })

  it('works with KNOWN_EXPLORER_HOSTS constant', () => {
    expect(safeExternalUrl('https://stellar.expert/tx/abc', KNOWN_EXPLORER_HOSTS)).toBe('https://stellar.expert/tx/abc')
    expect(safeExternalUrl('https://steexp.com/account/xyz', KNOWN_EXPLORER_HOSTS)).toBe('https://steexp.com/account/xyz')
    expect(safeExternalUrl('https://lumenscope.io/tx/123', KNOWN_EXPLORER_HOSTS)).toBe('https://lumenscope.io/tx/123')
    expect(safeExternalUrl('https://unknown.com', KNOWN_EXPLORER_HOSTS)).toBeNull()
  })

  it('handles protocol case insensitivity', () => {
    expect(safeExternalUrl('HTTP://example.com')).toBeNull() // URL constructor normalizes to http:
    expect(safeExternalUrl('HTTPS://example.com')).toBe('https://example.com')
  })

  it('prevents open-redirect attempts via @ syntax', () => {
    expect(safeExternalUrl('https://example.com@evil.com')).toBeNull()
    expect(safeExternalUrl('https://example.com:80@evil.com')).toBeNull()
  })
})
