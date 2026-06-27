'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { buildExplorerUrl, openExplorerUrl } from '@/utils/explorerLinks';
import { Copy, ExternalLink, LogOut, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

const truncateAddress = (address: string) =>
  address ? `${address.slice(0, 4)}…${address.slice(-4)}` : '';

const walletErrorMessage = (error: string | null) => {
  if (!error) return '';

  const normalized = error.toLowerCase();

  if (
    normalized.includes('freighter') ||
    normalized.includes('not installed') ||
    normalized.includes('not found')
  ) {
    return 'Freighter is not available. Install it from freighter.app and refresh to continue.';
  }

  if (
    normalized.includes('reject') ||
    normalized.includes('denied') ||
    normalized.includes('cancel')
  ) {
    return 'Connection canceled in Freighter. Try again when you are ready.';
  }

  return 'Unable to connect your wallet. Try again or check Freighter in your browser.';
};

export const WalletAccountMenu: React.FC = () => {
  const { connected, address, connect, disconnect, error, connecting } =
    useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [network, setNetwork] = useState<'public' | 'testnet'>('public');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch network from protocol constants
    const fetchNetwork = async () => {
      try {
        const response = await fetch('/api/protocol/constants');
        if (response.ok) {
          const data = await response.json();
          if (data.network === 'testnet') {
            setNetwork('testnet');
          } else {
            setNetwork('public');
          }
        }
      } catch (e) {
        // Default to public if fetch fails
        setNetwork('public');
      }
    };
    fetchNetwork();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy address:', e);
    }
  };

  const handleDisconnect = async () => {
    // Call logout API to clear session
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Failed to logout:', e);
    } finally {
      disconnect();
      setMenuOpen(false);
    }
  };

  const errorMessage = walletErrorMessage(error);

  return (
    <div className='relative inline-flex flex-col items-end gap-2 max-w-[240px]'>
      {connected ? (
        <div ref={containerRef} className='relative inline-block text-left'>
          <button
            type='button'
            className='inline-flex items-center justify-center rounded-[14px] border border-[rgba(0,212,255,0.6)] bg-[rgba(5,10,14,0.9)] px-4 py-2 text-sm font-medium text-white shadow-[0_0_14px_rgba(0,212,255,0.45)] transition-[box-shadow,transform] duration-300 ease-[ease] hover:shadow-[0_0_22px_rgba(0,212,255,0.7)] hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
            aria-haspopup='menu'
            aria-expanded={menuOpen}
            aria-label={`Connected wallet ${truncateAddress(address)}`}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>{truncateAddress(address)}</span>
            <ChevronDown
              className={clsx('ml-2 h-4 w-4 transition-transform duration-300', {
                'rotate-180': menuOpen,
              })}
            />
          </button>

          {menuOpen && (
            <div
              className='origin-top-right absolute right-0 mt-2 w-64 rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[#0a0a0a] shadow-[0_0_22px_rgba(0,0,0,0.45)] ring-1 ring-white ring-opacity-10'
              role='menu'
              aria-label='Wallet account menu'
            >
              <div className='px-4 py-3 border-b border-[rgba(255,255,255,0.08)]'>
                <p className='text-xs text-[#94A3B8] mb-1'>Connected Address</p>
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-white font-mono'>
                    {truncateAddress(address)}
                  </span>
                  <button
                    type='button'
                    onClick={handleCopyAddress}
                    className='p-1 rounded hover:bg-[rgba(0,212,255,0.15)]'
                    aria-label='Copy address'
                  >
                    <Copy className='h-4 w-4 text-[#94A3B8]' />
                  </button>
                </div>
                {copied && (
                  <p className='text-xs text-[#0FF0FC] mt-1'>Copied!</p>
                )}
              </div>
              <div className='px-4 py-3 border-b border-[rgba(255,255,255,0.08)]'>
                <p className='text-xs text-[#94A3B8] mb-1'>Network</p>
                <span className='text-sm text-white font-medium'>
                  {network.charAt(0).toUpperCase() + network.slice(1)}
                </span>
              </div>
              <div className='py-1'>
                <button
                  type='button'
                  className='flex items-center gap-2 w-full rounded-[14px] px-4 py-2 text-left text-sm text-white transition-colors duration-200 ease-[ease] hover:bg-[rgba(0,212,255,0.15)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
                  role='menuitem'
                  onClick={() => {
                    openExplorerUrl('account', address, network);
                    setMenuOpen(false);
                  }}
                >
                  <ExternalLink className='h-4 w-4' />
                  View on Stellar.Expert
                </button>
                <button
                  type='button'
                  className='flex items-center gap-2 w-full rounded-[14px] px-4 py-2 text-left text-sm text-white transition-colors duration-200 ease-[ease] hover:bg-[rgba(0,212,255,0.15)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
                  role='menuitem'
                  onClick={handleDisconnect}
                >
                  <LogOut className='h-4 w-4' />
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type='button'
          className='inline-flex items-center justify-center rounded-[14px] border border-[rgba(0,212,255,0.6)] bg-[rgba(5,10,14,0.9)] px-6 py-2 text-sm font-medium text-white shadow-[0_0_14px_rgba(0,212,255,0.45)] transition-[box-shadow,transform] duration-300 ease-[ease] hover:shadow-[0_0_22px_rgba(0,212,255,0.7)] hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60'
          onClick={connect}
          disabled={connecting}
          aria-live='polite'
        >
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      )}

      {errorMessage ? (
        <p
          role='alert'
          className='max-w-[240px] text-left text-[13px] leading-5 text-[#F8C3C3]'
          aria-live='polite'
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};
