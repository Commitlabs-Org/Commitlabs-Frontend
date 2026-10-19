'use client';

import { useWallet } from './WalletProvider';

export function WalletNotice() {
  const { message, status } = useWallet();
  if (!message || status === 'connected') return null;
  return (
    <div className="notice" role="status">
      {message}
    </div>
  );
}
