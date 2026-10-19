'use client';

import React, { useEffect } from 'react';

export interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[GlobalError caught error]:', error);
    }
  }, [error]);

  const isProduction = process.env.NODE_ENV === 'production';
  const rawMessage = error.message || 'A critical application error occurred.';
  const displayMessage = isProduction
    ? rawMessage.replace(/https?:\/\/[^\s]+/g, (matched) => matched.split('?')[0])
    : rawMessage;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#0b0d14',
          color: '#e8ebf5',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            background: '#151a28',
            border: '1px solid #242b3f',
            borderRadius: '16px',
            padding: '36px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(248, 113, 113, 0.15)',
              border: '1px solid #f87171',
              color: '#f87171',
              display: 'grid',
              placeItems: 'center',
              fontSize: '1.8rem',
              fontWeight: 'bold',
              margin: '0 auto 16px',
            }}
            aria-hidden="true"
          >
            !
          </div>

          <h1
            style={{
              fontSize: '1.8rem',
              margin: '0 0 12px',
              color: '#e8ebf5',
            }}
          >
            Application Error
          </h1>

          <p
            style={{
              color: '#98a1bb',
              fontSize: '0.95rem',
              lineHeight: 1.5,
              margin: '0 0 20px',
            }}
          >
            A critical error prevented the application from loading. You can attempt to recover by clicking below.
          </p>

          <div
            role="alert"
            style={{
              background: '#11141f',
              border: '1px solid #242b3f',
              borderRadius: '8px',
              padding: '12px',
              color: '#98a1bb',
              fontSize: '0.85rem',
              textAlign: 'left',
              wordBreak: 'break-word',
              marginBottom: '24px',
            }}
          >
            <b>Details:</b> {displayMessage}
            {error.digest && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                Digest: {error.digest}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: 'linear-gradient(135deg, #5eead4, #818cf8)',
                color: '#07101a',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/';
                }
              }}
              style={{
                background: 'transparent',
                border: '1px solid #242b3f',
                color: '#e8ebf5',
                borderRadius: '10px',
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Reload application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
