import Link from 'next/link';
import { LIVE_URL, REPO_URL, config } from '@/lib/config';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>CommitLabs &middot; Liquidity as a commitment on Stellar Soroban</span>
        <span className="footer-links">
          <Link href="/docs">Docs</Link>
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
