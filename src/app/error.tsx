'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[RouteError caught error]:', error);
    }
  }, [error]);

  const isProduction = process.env.NODE_ENV === 'production';
  // Strip query params and sensitive URL info from error message
  const rawMessage = error.message || 'An unexpected application error occurred.';
  const displayMessage = isProduction
    ? rawMessage.replace(/https?:\/\/[^\s]+/g, (matched) => matched.split('?')[0])
    : rawMessage;

  return (
    <section className="container page center">
      <div className="card error-boundary-card">
        <div className="error-boundary-icon" aria-hidden="true">
          !
        </div>
        <h1>Something went wrong</h1>
        <p className="muted">
          We encountered an error while loading this page. You can try refreshing the component or return to the dashboard.
        </p>

        <div className="error-boundary-details" role="alert">
          <b>Error:</b> {displayMessage}
          {error.digest && <div className="small muted">Digest: {error.digest}</div>}
        </div>

        <div className="row center-row">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/dashboard" className="btn btn-ghost">
            Back to dashboard
          </Link>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </section>
  );
}
