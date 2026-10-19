'use client';

import React from 'react';

export interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  className?: string;
}

export function InlineError({
  message,
  onRetry,
  retryLabel = 'Retry',
  action,
  className = '',
}: InlineErrorProps) {
  return (
    <div className={`inline-error ${className}`.trim()} role="alert">
      <span className="inline-error-msg">{message}</span>
      <div className="inline-error-actions">
        {action}
        {onRetry && (
          <button
            type="button"
            className="btn btn-ghost btn-sm inline-error-retry"
            onClick={onRetry}
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
