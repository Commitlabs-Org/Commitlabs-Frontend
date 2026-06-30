'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import useReducedMotion from '@/lib/a11y/useReducedMotion';
import { getGraceCountdownStatus } from './gracePeriod';

export interface GraceCountdownBannerProps {
  maturityDate: Date;
  gracePeriodDays: number | null;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

export function GraceCountdownBanner({
  maturityDate,
  gracePeriodDays,
}: GraceCountdownBannerProps) {
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(
      () => setNow(new Date()),
      reducedMotion ? MINUTE_MS : SECOND_MS,
    );

    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const status = useMemo(
    () => getGraceCountdownStatus({
      gracePeriodDays,
      maturityDate,
      now,
      reducedMotion,
    }),
    [gracePeriodDays, maturityDate, now, reducedMotion],
  );

  const Icon =
    status.state === 'in_grace'
      ? ShieldCheck
      : status.state === 'pre_grace'
        ? Clock
        : AlertTriangle;

  const toneClass =
    status.state === 'in_grace'
      ? 'border-[#0FF0FC]/30 bg-[#0FF0FC]/10 text-[#0FF0FC]'
      : 'border-[#FF8A04]/25 bg-[#FF8A04]/10 text-[#FF8A04]';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`mb-6 rounded-2xl border p-4 ${toneClass}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-black/20">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-widest">
            {status.title}
          </p>
          <p className="mt-1 text-[13px] font-medium leading-snug text-white/75">
            {status.detail}
          </p>
          {status.targetDate && (
            <p className="mt-2 text-[12px] leading-snug text-white/45">
              Target date: {status.targetDate.toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
