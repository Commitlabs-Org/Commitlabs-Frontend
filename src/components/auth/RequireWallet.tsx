'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../hooks/useWallet';

interface RequireWalletProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * RequireWallet - Auth guard that ensures wallet is connected
 *
 * If wallet is not connected, shows a connect prompt instead of children.
 * Optionally redirects to a specified path.
 */
export function RequireWallet({ children, redirectTo }: RequireWalletProps) {
  const router = useRouter();
  const { isConnected, isConnecting, connect, error } = useWallet();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Check connection status
  useEffect(() => {
    if (redirectTo && !isConnected && !isConnecting) {
      setShouldRedirect(true);
    }
  }, [isConnected, isConnecting, redirectTo]);

  // Handle redirect
  useEffect(() => {
    if (shouldRedirect) {
      router.push(redirectTo);
    }
  }, [shouldRedirect, router, redirectTo]);

  // Show loading state while connecting
  if (isConnecting) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Connecting wallet...</p>
        </div>
      </div>
    );
  }

  // Show connect prompt if not connected
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full mx-auto p-8 bg-white rounded-xl shadow-lg text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Wallet Required</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to access this page.</p>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            onClick={connect}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
          >
            Connect Wallet
          </button>
          <p className="mt-4 text-sm text-gray-500">
            <a href="/" className="text-blue-600 hover:underline">
              Return to home
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Wallet is connected, render children
  return <>{children}</>;
}
