import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Commitment — CommitLabs',
  description:
    'Create a new on-chain liquidity commitment on CommitLabs. Choose a risk profile (Safe, Balanced, Aggressive), set the amount, duration, and max loss parameters.',
  openGraph: {
    title: 'Create Commitment — CommitLabs',
    description:
      'Create a new on-chain liquidity commitment on CommitLabs with your preferred risk profile.',
    url: 'https://commitlabs.com/create',
    siteName: 'CommitLabs',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Create Commitment — CommitLabs',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Create Commitment — CommitLabs',
    description:
      'Create a new on-chain liquidity commitment on CommitLabs with your preferred risk profile.',
    images: ['/og-image.jpg'],
  },
}

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
