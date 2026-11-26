'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export interface CommitmentDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CommitmentDetailError({ error, reset }: CommitmentDetailErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[CommitmentDetailError caught error]:', error);
    }
  }, [error]);

  const isProduction = process.env.NODE_ENV === 'production';
  const rawMessage = error?.message || 'Unable to retrieve commitment record from on-chain escrow.';
  const displayMessage = isProduction
    ? rawMessage.replace(/https?:\/\/[^\s]+/g, (matched) => matched.split('?')[0])
    : rawMessage;

  return (
    <section className="container page center" aria-label="Commitment detail error">
      <div className="card error-boundary-card">
        <div className="error-boundary-icon" aria-hidden="true">
          !
        </div>
        <h1>Unable to load commitment</h1>
        <p className="muted">
          We encountered an error while communicating with the escrow contract or parsing commitment data.
        </p>

        <div className="error-boundary-details" role="alert">
          <b>Error:</b> {displayMessage}
          {error?.digest && <div className="small muted">Digest: {error.digest}</div>}
        </div>

        <div className="row center-row">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/dashboard" className="btn btn-ghost">
            Back to dashboard
          </Link>
          <Link href="/activity" className="btn btn-ghost">
            Activity feed
          </Link>
        </div>
      </div>
    </section>
  );
}
