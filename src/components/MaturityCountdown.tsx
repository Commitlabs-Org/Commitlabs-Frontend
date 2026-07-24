import React, { useState, useEffect } from 'react';
import { formatRemaining, RemainingMaturity } from '../utils/formatRemaining';

export interface MaturityCountdownProps {
  maturityTimestamp: number;
}

export const MaturityCountdown: React.FC<MaturityCountdownProps> = ({
  maturityTimestamp,
}) => {
  const [countdown, setCountdown] = useState<RemainingMaturity>(() =>
    formatRemaining(maturityTimestamp)
  );

  useEffect(() => {
    // Re-evaluate immediately in case of delay
    setCountdown(formatRemaining(maturityTimestamp));

    // Update every 60 seconds
    const interval = setInterval(() => {
      const updated = formatRemaining(maturityTimestamp);
      setCountdown(updated);
      
      if (updated.status === 'matured') {
        clearInterval(interval);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [maturityTimestamp]);

  return (
    <span
      className={`maturity-badge badge-${countdown.status}`}
      aria-live="polite"
      aria-atomic="true"
      title="Time until maturity"
    >
      {countdown.text}
    </span>
  );
};