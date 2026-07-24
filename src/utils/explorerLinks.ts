export type ExplorerLinkKind = 'account' | 'contract' | 'tx' | 'token'
export type ExplorerNetwork = 'public' | 'testnet'

const EXPLORER_ORIGIN = 'https://stellar.expert'
const VALID_NETWORKS = new Set<ExplorerNetwork>(['public', 'testnet'])
const TX_HASH_PATTERN = /^[A-Fa-f0-9]{64}$/
const ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/
const CONTRACT_PATTERN = /^C[A-Z2-7]{55}$/
const TOKEN_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

const PATH_BY_KIND: Record<ExplorerLinkKind, string> = {
  account: 'account',
  contract: 'contract',
  tx: 'tx',
  token: 'asset',
}

function isValidIdentifier(kind: ExplorerLinkKind, id: string): boolean {
  if (id !== id.trim()) return false

  switch (kind) {
    case 'account':
      return ACCOUNT_PATTERN.test(id)
    case 'contract':
      return CONTRACT_PATTERN.test(id)
    case 'tx':
      return TX_HASH_PATTERN.test(id)
    case 'token':
      return TOKEN_PATTERN.test(id)
  }
}

export function buildExplorerUrl(
  kind: ExplorerLinkKind,
  id: string | null | undefined,
  network: ExplorerNetwork = 'public',
): string | null {
  if (!id || !VALID_NETWORKS.has(network) || !isValidIdentifier(kind, id)) {
    return null
  }

  const url = new URL(`/explorer/${network}/${PATH_BY_KIND[kind]}/${encodeURIComponent(id)}`, EXPLORER_ORIGIN)
  return url.toString()
}

export function openExplorerUrl(
  kind: ExplorerLinkKind,
  id: string | null | undefined,
  network?: ExplorerNetwork,
): boolean {
  const url = buildExplorerUrl(kind, id, network)
  if (!url) return false

  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

/**
 * Validates and sanitizes externally-sourced URLs (e.g., from NFT metadata or commitment fields).
 * Only allows http/https schemes and optionally restricts to known explorer hosts.
 * Returns null for invalid URLs to prevent javascript:/data: schemes and open-redirect attacks.
 *
 * @param url - The URL to validate (can be null/undefined)
 * @param allowedHosts - Optional set of allowed hostnames (e.g., ['stellar.expert']). If omitted, only http(s) scheme is enforced.
 * @returns The validated URL string, or null if invalid
 */
export function safeExternalUrl(
  url: string | null | undefined,
  allowedHosts?: Set<string>,
): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    const parsed = new URL(url)

    // Reject dangerous schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }

    // If allowedHosts is provided, enforce host allowlist
    if (allowedHosts && allowedHosts.size > 0) {
      if (!allowedHosts.has(parsed.hostname)) {
        return null
      }
    }

    return url
  } catch {
    // Invalid URL syntax
    return null
  }
}

/**
 * Known safe explorer hosts for external link validation.
 * Extend this set as new explorers are integrated.
 */
export const KNOWN_EXPLORER_HOSTS = new Set([
  'stellar.expert',
  'steexp.com',
  'lumenscope.io',
])
