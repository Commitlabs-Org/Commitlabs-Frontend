'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { getValidatedClientEnv } from '@/lib/clientEnv';

const APP_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';

function getAppPassphrase(): string {
  try {
    return getValidatedClientEnv().NEXT_PUBLIC_NETWORK_PASSPHRASE ?? APP_PASSPHRASE;
  } catch {
    return APP_PASSPHRASE;
  }
}

export const NetworkMismatchBanner: React.FC = () => {
  const { connected, walletNetwork } = useWallet();
  const [dismissed, setDismissed] = useState(false);

  const appPassphrase = getAppPassphrase();
  const isMismatch = connected && walletNetwork !== null && walletNetwork !== appPassphrase;

  // Re-show the banner whenever walletNetwork changes while mismatched
  useEffect(() => {
    if (isMismatch) {
      setDismissed(false);
    }
  }, [walletNetwork]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isMismatch || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center justify-between gap-3 bg-yellow-900/80 border border-yellow-500/60 text-yellow-100 px-4 py-3 text-sm"
    >
      <span>
        Your wallet is on a different network than this app. Please switch your
        Freighter wallet to the correct network before making any transactions.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="https://www.freighter.app"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium hover:text-yellow-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded"
        >
          Switch in wallet
        </a>
        <button
          type="button"
          aria-label="Dismiss network mismatch warning"
          onClick={() => setDismissed(true)}
          className="ml-2 p-1 rounded hover:bg-yellow-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
