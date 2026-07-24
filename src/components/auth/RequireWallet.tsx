'use client'

import React, { useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowRight, ShieldCheck, Wallet } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'
import { useWallet } from '@/components/auth/WalletProvider'

interface RequireWalletProps {
  children: React.ReactNode
}

function formatRouteLabel(pathname: string) {
  if (pathname === '/create') {
    return 'create a commitment'
  }

  if (pathname === '/settings') {
    return 'manage your settings'
  }

  if (pathname.startsWith('/commitments')) {
    return 'view your commitments'
  }

  return 'continue'
}

export default function RequireWallet({ children }: RequireWalletProps) {
  const pathname = usePathname()
  const { connected, connect, error, status } = useWallet()
  const [connectError, setConnectError] = useState<string | null>(null)
  const connectButtonRef = useRef<HTMLButtonElement>(null)

  const routeAction = useMemo(() => formatRouteLabel(pathname), [pathname])

  if (connected) {
    return <>{children}</>
  }

  const handleConnect = async () => {
    setConnectError(null)

    try {
      await connect()
    } catch (nextError) {
      setConnectError(nextError instanceof Error ? nextError.message : 'Unable to connect wallet.')
    }
  }

  return (
    <Dialog
      open
      title="Connect your wallet to continue"
      description={`You need a connected wallet to ${routeAction}. Once connected, you’ll stay on ${pathname} and we’ll continue right where you left off.`}
      initialFocusRef={connectButtonRef}
    >
      <div className="space-y-6">
        <div className="rounded-[28px] border border-[#0ff0fc1f] bg-[linear-gradient(180deg,rgba(15,240,252,0.12),rgba(15,240,252,0.04))] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#0ff0fc59] bg-[#0ff0fc14]">
              <ShieldCheck className="h-6 w-6 text-[#0ff0fc]" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0ff0fc]">Protected route</p>
              <p className="text-sm leading-6 text-white/80">
                CommitLabs uses your wallet connection to load your commitments, preserve drafts, and personalize secure actions on this route.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Requested route</p>
          <p className="mt-2 font-mono text-[15px] text-[#d9f9fb]">{pathname}</p>
        </div>

        {(connectError || error) ? (
          <p className="rounded-2xl border border-[#ff7b7b3b] bg-[#ff7b7b14] px-4 py-3 text-sm leading-6 text-[#ffd7d7]">
            {connectError || error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            ref={connectButtonRef}
            type="button"
            onClick={handleConnect}
            disabled={status === 'connecting'}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0ff0fc] px-5 py-4 text-sm font-semibold text-[#071014] transition hover:bg-[#6ff7ff] disabled:cursor-not-allowed disabled:bg-[#0ff0fc80]"
          >
            <Wallet className="h-4 w-4" />
            {status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
          </button>
          <span className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/72">
            Return after connect
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Dialog>
  )
}
