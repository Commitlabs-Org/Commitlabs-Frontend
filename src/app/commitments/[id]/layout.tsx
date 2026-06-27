import type { Metadata } from 'next'

type Props = { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = params.id
  const title = `Commitment #${id} — CommitLabs`
  const description = `View performance metrics, compliance scores, and activity for commitment #${id} on CommitLabs.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://commitlabs.com/commitments/${id}`,
      siteName: 'CommitLabs',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: title }],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.jpg'],
    },
  }
}

export default function CommitmentDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
