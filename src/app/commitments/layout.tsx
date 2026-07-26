import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Commitments — CommitLabs',
  description:
    'Manage your active liquidity commitments on CommitLabs. Track performance, compliance scores, drawdown, and access early exit options.',
  openGraph: {
    title: 'My Commitments — CommitLabs',
    description:
      'Manage your active liquidity commitments on CommitLabs. Track performance, compliance scores, and more.',
    url: 'https://commitlabs.com/commitments',
    siteName: 'CommitLabs',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'My Commitments — CommitLabs',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Commitments — CommitLabs',
    description:
      'Manage your active liquidity commitments on CommitLabs.',
    images: ['/og-image.jpg'],
  },
}

export default function CommitmentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
