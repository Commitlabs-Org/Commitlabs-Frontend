import type { Metadata } from 'next';
import './globals.css';
import ScrollToTopButton from '@/components/landing-page/ui/ScrollToTop';
import { SITE_URL } from '@/lib/site';
import { CommandPalette, CommandPaletteProvider } from '@/components/CommandPalette';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'CommitLabs - Liquidity as a Commitment',
  description:
    'Transform passive liquidity into enforceable, attestable, and composable on-chain commitments',
  keywords: 'liquidity, commitment, blockchain, DeFi, NFT, Stellar, Soroban',
  authors: [{ name: 'CommitLabs' }],
  creator: 'CommitLabs',
  publisher: 'CommitLabs',
  openGraph: {
    title: 'CommitLabs - Liquidity as a Commitment',
    description:
      'Transform passive liquidity into enforceable, attestable, and composable on-chain commitments',
    url: `${SITE_URL}/`,
    siteName: 'CommitLabs',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'CommitLabs - Liquidity as a Commitment',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CommitLabs - Liquidity as a Commitment',
    description:
      'Transform passive liquidity into enforceable, attestable, and composable on-chain commitments',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={['scroll-smooth', inter.variable, robotoMono.variable].join(' ')}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'CommitLabs',
              description:
                'Transform passive liquidity into enforceable, attestable, and composable on-chain commitments',
              url: `${SITE_URL}/`,
              publisher: {
                '@type': 'Organization',
                name: 'CommitLabs',
                url: `${SITE_URL}/`,
              },
            }),
          }}
        />
      </head>
      <body>
        <WebVitalsReporter />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider>
          <WalletProvider>
            <MotionProvider>
              <ToastProvider>
                <NetworkMismatchBanner />
                <CommandPaletteProvider>
                  <AppShellConnectionStatus>{children}</AppShellConnectionStatus>
                  <CommandPalette />
                </CommandPaletteProvider>
                <ScrollToTopButton />
              </ToastProvider>
            </MotionProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
