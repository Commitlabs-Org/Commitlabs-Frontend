import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notifications - CommitLabs',
  description: 'View and manage your protocol notifications, violation alerts, expiry warnings, and marketplace events.',
}

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
