'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from './WalletProvider';
import { shortAddress } from '@/lib/format';
import { useNetwork } from './NetworkProvider';
import { NETWORKS, NETWORK_IDS, type NetworkId } from '@/lib/network';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { href: '/create', label: 'Create' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/activity', label: 'Activity' },
  { href: '/docs', label: 'Docs' },
];

export function Header() {
  const path = usePathname();
  const { status, address, connect, disconnect } = useWallet();
  const { network, setNetwork } = useNetwork();
  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="CommitLabs home">
          <span className="brand-mark" aria-hidden="true" />
          CommitLabs
        </Link>
        <nav className="nav" aria-label="Primary">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={path?.startsWith(l.href) ? 'nav-link active' : 'nav-link'}
              aria-current={path?.startsWith(l.href) ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <label className="sr-only" htmlFor="network-select">
          Stellar network
        </label>
        <select
          id="network-select"
          className="network-select"
          value={network}
          onChange={(e) => setNetwork(e.target.value as NetworkId)}
        >
          {NETWORK_IDS.map((id) => (
            <option key={id} value={id}>
              {NETWORKS[id].label}
            </option>
          ))}
        </select>
        <ThemeToggle />
        {status === 'connected' && address ? (
          <button className="btn btn-ghost" onClick={disconnect} title="Disconnect wallet">
            <span className="dot" /> {shortAddress(address)}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={connect} disabled={status === 'connecting'}>
            {status === 'connecting' ? 'Connecting...' : 'Connect wallet'}
          </button>
        )}
      </div>
    </header>
  );
}
