// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { buildExplorerUrl, openExplorerUrl } from '../explorerLinks'

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
