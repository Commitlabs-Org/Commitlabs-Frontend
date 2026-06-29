import type { Metadata } from 'next'
import './globals.css'
import ScrollToTopButton from '@/components/landing-page/ui/ScrollToTop'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { ToastProvider } from '@/components/toast/ToastProvider'
import { CommandPaletteProvider } from '@/components/CommandPalette'
import { NetworkMismatchBanner } from '@/components/wallet/NetworkMismatchBanner'
import { Inter, Roboto_Mono } from 'next/font/google'
import { MotionProvider } from '@/components/MotionProvider'
import { AppShellConnectionStatus } from '@/components/shell/AppShellConnectionStatus'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-roboto',
})

export const metadata: Metadata = {
  title: 'CommitLabs - Liquidity as a Commitment',
  description: 'Transform passive liquidity into enforceable, attestable, and composable on-chain commitments',
  keywords: 'liquidity, commitment, blockchain, DeFi, NFT, Stellar, Soroban',
  authors: [{ name: 'CommitLabs' }],
  creator: 'CommitLabs',
  publisher: 'CommitLabs',
  openGraph: {
    title: 'CommitLabs - Liquidity as a Commitment',
    description: 'Transform passive liquidity into enforceable, attestable, and composable on-chain commitments',
    url: 'https://commitlabs.com',
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
    description: 'Transform passive liquidity into enforceable, attestable, and composable on-chain commitments',
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
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? {
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    },
  } : {}),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
              description: 'Transform passive liquidity into enforceable, attestable, and composable on-chain commitments',
              url: 'https://commitlabs.com',
              publisher: {
                '@type': 'Organization',
                name: 'CommitLabs',
                url: 'https://commitlabs.com',
              },
            }),
          }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ThemeProvider>
          <MotionProvider>
            <ToastProvider>
              <NetworkMismatchBanner />
              <AppShellConnectionStatus>{children}</AppShellConnectionStatus>
              <ScrollToTopButton />
              <CommandPaletteProvider />
            </ToastProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
