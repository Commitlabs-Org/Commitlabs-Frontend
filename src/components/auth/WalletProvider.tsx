'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'commitlabs.wallet.address'

type WalletStatus = 'idle' | 'connecting' | 'connected'

export interface WalletContextValue {
  address: string | null
  connected: boolean
  status: WalletStatus
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

declare global {
  interface Window {
    freighterApi?: {
      getAddress?: () => Promise<{ address?: string; error?: string } | string>
      requestAccess?: () => Promise<{ address?: string; error?: string } | string>
      isConnected?: () => Promise<{ isConnected?: boolean; error?: string } | boolean>
    }
  }
}

async function getFreighterModule() {
  try {
    return await import('@stellar/freighter-api')
  } catch {
    return null
  }
}

async function checkWalletConnection(): Promise<boolean | null> {
  const browserApi = typeof window !== 'undefined' ? window.freighterApi : undefined

  if (browserApi?.isConnected) {
    const result = await browserApi.isConnected()
    if (typeof result === 'boolean') {
      return result
    }
    if (typeof result?.isConnected === 'boolean') {
      return result.isConnected
    }
    return null
  }

  const freighter = await getFreighterModule()
  if (freighter?.isConnected) {
    const result = await freighter.isConnected()
    if (typeof result === 'boolean') {
      return result
    }
    if ('isConnected' in result && typeof result.isConnected === 'boolean') {
      return result.isConnected
    }
  }

  return null
}

function readStoredAddress() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(STORAGE_KEY)
}

function persistAddress(address: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (address) {
    window.localStorage.setItem(STORAGE_KEY, address)
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
}

async function requestWalletAddress(): Promise<string> {
  const browserApi = typeof window !== 'undefined' ? window.freighterApi : undefined

  if (browserApi?.requestAccess) {
    const result = await browserApi.requestAccess()
    if (typeof result === 'string') {
      return result
    }
    if (result?.address) {
      return result.address
    }
    throw new Error(result?.error ?? 'Unable to connect wallet.')
  }

  if (browserApi?.getAddress) {
    const result = await browserApi.getAddress()
    if (typeof result === 'string') {
      return result
    }
    if (result?.address) {
      return result.address
    }
    throw new Error(result?.error ?? 'Unable to read wallet address.')
  }

  const freighter = await getFreighterModule()
  if (freighter?.requestAccess) {
    const result = await freighter.requestAccess()
    if (typeof result === 'string') {
      return result
    }
    if ('address' in result && result.address) {
      return result.address
    }
    if ('error' in result && result.error) {
      throw new Error(result.error)
    }
  }

  if (freighter?.getAddress) {
    const result = await freighter.getAddress()
    if (typeof result === 'string') {
      return result
    }
    if ('address' in result && result.address) {
      return result.address
    }
    if ('error' in result && result.error) {
      throw new Error(result.error)
    }
  }

  throw new Error('Freighter wallet is not available. Install or unlock Freighter to continue.')
}

interface WalletProviderProps {
  children: React.ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [address, setAddress] = useState<string | null>(null)
  const [status, setStatus] = useState<WalletStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const syncStoredWallet = async () => {
      const storedAddress = readStoredAddress()
      if (!storedAddress) {
        return
      }

      const isConnected = await checkWalletConnection()
      if (cancelled) {
        return
      }

      if (isConnected === false) {
        persistAddress(null)
        return
      }

      setAddress(storedAddress)
      setStatus('connected')
    }

    void syncStoredWallet()

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<WalletContextValue>(() => ({
    address,
    connected: Boolean(address),
    status,
    error,
    connect: async () => {
      setStatus('connecting')
      setError(null)

      try {
        const nextAddress = await requestWalletAddress()
        setAddress(nextAddress)
        setStatus('connected')
        persistAddress(nextAddress)
      } catch (connectError) {
        setStatus('idle')
        setError(connectError instanceof Error ? connectError.message : 'Unable to connect wallet.')
        throw connectError
      }
    },
    disconnect: () => {
      setAddress(null)
      setStatus('idle')
      setError(null)
      persistAddress(null)
    },
  }), [address, error, status])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)

  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider.')
  }

  return context
}
