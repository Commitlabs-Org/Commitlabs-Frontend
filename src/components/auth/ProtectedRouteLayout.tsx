'use client';

import { ReactNode } from 'react';
import { RequireWallet } from './RequireWallet';

interface ProtectedRouteLayoutProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * ProtectedRouteLayout - Layout wrapper that protects routes with wallet auth
 *
 * This component wraps route layouts to ensure the user has a connected wallet
 * before accessing the protected page content.
 */
export function ProtectedRouteLayout({ children, redirectTo = '/' }: ProtectedRouteLayoutProps) {
  return <RequireWallet redirectTo={redirectTo}>{children}</RequireWallet>;
}
