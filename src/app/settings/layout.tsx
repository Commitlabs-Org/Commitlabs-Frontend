import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings — CommitLabs',
  description:
    'Manage your CommitLabs notification preferences, security thresholds, and account settings. Stay informed about violations, expiries, and marketplace activity.',
  openGraph: {
    title: 'Settings — CommitLabs',
    description:
      'Manage your CommitLabs notification preferences and security settings.',
    url: 'https://commitlabs.com/settings',
    siteName: 'CommitLabs',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Settings — CommitLabs',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Settings — CommitLabs',
    description:
      'Manage your CommitLabs notification preferences and security settings.',
    images: ['/og-image.jpg'],
  },
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
