'use client'

import React, { useState } from 'react'
import { Wallet, Copy, ExternalLink, LogOut } from 'lucide-react'
import { useWallet } from '@/hooks/useWallet'
import { buildExplorerUrl } from '@/utils/explorerLinks'
import { NotificationSection } from './NotificationSection'
import { WalletConnectButton } from '../WalletConnectButton'

const truncateAddress = (address: string) =>
  address ? `${address.slice(0, 4)}…${address.slice(-4)}` : ''

export const AccountWalletSection: React.FC = () => {
  const { connected, address, connect, disconnect } = useWallet()
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleCopy = async () => {
    if (!address) return
    setCopying(true)
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy address:', e)
    } finally {
      setCopying(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      })
      disconnect()
    } catch (e) {
      console.error('Failed to sign out:', e)
    } finally {
      setSigningOut(false)
    }
  }

  const explorerUrl = buildExplorerUrl('account', address, 'public')

  return (
    <NotificationSection
      title="Account & Wallet"
      description="Manage your wallet connection and session settings."
      icon={<Wallet size={20} />}
    >
      {connected ? (
        <div className="space-y-4 p-6 rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0FF0FC]/10 text-[#0FF0FC]">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-sm text-white/50">Connected Address</p>
                <p className="font-mono text-white">{truncateAddress(address)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all"
                  title="View on Stellar Explorer"
                >
                  <ExternalLink size={18} />
                </a>
              )}
              <button
                onClick={handleCopy}
                disabled={copying}
                className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all"
                title={copied ? 'Copied!' : 'Copy Address'}
              >
                <Copy size={18} />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className={`
                w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all active:scale-[0.98]
                ${signingOut
                  ? 'bg-red-500/30 text-red-200 cursor-not-allowed'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 border border-red-500/20'
                }
              `}
            >
              {signingOut ? (
                <div className="h-5 w-5 border-2 border-red-200/30 border-t-red-200 rounded-full animate-spin" />
              ) : (
                <>
                  <LogOut size={18} />
                  Sign Out
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-white/70 mb-4">Connect your wallet to manage your account settings.</p>
          <WalletConnectButton />
        </div>
      )}
    </NotificationSection>
  )
}
