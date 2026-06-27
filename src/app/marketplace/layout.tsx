import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Marketplace — CommitLabs',
  description:
    'Browse, filter, and trade liquidity commitments on the CommitLabs marketplace. Discover high-yield opportunities with transparent compliance scores and real-time performance data.',
  openGraph: {
    title: 'Marketplace — CommitLabs',
    description:
      'Browse, filter, and trade liquidity commitments on the CommitLabs marketplace.',
    url: 'https://commitlabs.com/marketplace',
    siteName: 'CommitLabs',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'CommitLabs Marketplace',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Marketplace — CommitLabs',
    description:
      'Browse, filter, and trade liquidity commitments on the CommitLabs marketplace.',
    images: ['/og-image.jpg'],
  },
}

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
