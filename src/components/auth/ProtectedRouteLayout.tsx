'use client'

import React from 'react'
import RequireWallet from '@/components/auth/RequireWallet'

interface ProtectedRouteLayoutProps {
  children: React.ReactNode
}

export default function ProtectedRouteLayout({ children }: ProtectedRouteLayoutProps) {
  return <RequireWallet>{children}</RequireWallet>
}
