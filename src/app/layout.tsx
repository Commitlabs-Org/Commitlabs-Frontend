import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';
import { ProtocolStatusProvider } from '@/components/ProtocolStatusProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { WalletNotice } from '@/components/WalletNotice';
import { PausedBanner } from '@/components/PausedBanner';

export const metadata: Metadata = {
  title: 'CommitLabs - Liquidity as a Commitment',
  description:
    'Turn passive liquidity into enforceable, attestable on-chain commitments on Stellar Soroban.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The middleware sets a per-request nonce (see src/middleware.ts): it goes
  // out on the CSP response header and comes back on the request as `x-nonce`.
  // Reading a request header here also opts every route into dynamic
  // rendering, which is required — with static prerendering Next.js cannot
  // stamp the nonce onto its own <script> tags and the browser would block
  // them under `script-src 'strict-dynamic'`.
  const nonce = headers().get('x-nonce') ?? undefined;

  return (
    <html lang="en" nonce={nonce}>
      <body>
        <WalletProvider>
          <ProtocolStatusProvider>
            <Header />
            <PausedBanner />
            <WalletNotice />
            <main id="main-content">{children}</main>
            <Footer />
          </ProtocolStatusProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
