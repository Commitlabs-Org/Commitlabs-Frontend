'use client';

import { ReactNode } from 'react';
import { RequireWallet } from './RequireWallet';

interface ProtectedRouteLayoutProps {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
}

/**
 * ProtectedRouteLayout - Layout wrapper that protects routes with wallet auth
 *
 * This component wraps route layouts to ensure the user has a connected wallet
 * before accessing the protected page content.
 */
export function ProtectedRouteLayout({
  children,
  redirectTo = '/',
  fallback,
}: ProtectedRouteLayoutProps) {
  return (
    <RequireWallet redirectTo={redirectTo} fallback={fallback}>
      {children}
    </RequireWallet>
  );
}