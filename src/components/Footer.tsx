'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LIVE_URL, REPO_URL, config } from '@/lib/config';
import { useWallet } from '@/components/WalletProvider';

export function Footer() {
  const { status, address } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    if (status !== 'connected' || !address) {
      setIsAdmin(false);
      return;
    }

    // Lazy-load so freighter-api and stellar-sdk stay out of the first-load bundle of every route
    import('@/lib/soroban/admin')
      .then(({ getAdmin }) => getAdmin())
      .then((admin) => {
        if (active) {
          setIsAdmin(Boolean(admin && admin.toUpperCase() === address.toUpperCase()));
        }
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });

    return () => {
      active = false;
    };
  }, [status, address]);

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>CommitLabs &middot; Liquidity as a commitment on Stellar Soroban</span>
        <span className="footer-links">
          <Link href="/docs">Docs</Link>
          {isAdmin && <Link href="/admin">Admin</Link>}
          <a href={LIVE_URL} target="_blank" rel="noreferrer">
            Live demo
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={config.networkDetails.explorerBaseUrl} target="_blank" rel="noreferrer">
            {config.networkDetails.label} explorer
          </a>
        </span>
      </div>
    </footer>
  );
}
