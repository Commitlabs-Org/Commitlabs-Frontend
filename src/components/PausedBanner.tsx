'use client';

import React from 'react';
import { useProtocolStatus } from './ProtocolStatusProvider';

export const PAUSED_BANNER_TEXT =
  'Escrow is paused by the operator. New commitments, funding and early exits are temporarily disabled. Matured settlements are unaffected.';

export function PausedBanner() {
  const { status, paused } = useProtocolStatus();

  // RPC failure never blocks actions and never shows the paused banner.
  // Only display the banner when protocol status is 'ok' and paused is true.
  if (status !== 'ok' || !paused) {
    return null;
  }

  return (
    <div className="paused-banner" role="status" aria-live="polite">
      <div className="container">
        <p>{PAUSED_BANNER_TEXT}</p>
      </div>
    </div>
  );
}
