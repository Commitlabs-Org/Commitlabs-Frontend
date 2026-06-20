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
